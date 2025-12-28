import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Map as MapIcon, MessageSquare, Compass, Loader2, Calendar, Trash2, X, Filter, ArrowUpDown } from 'lucide-react';
import MapComponent from './components/MapComponent';
import ChatMessage from './components/ChatMessage';
import WeatherWidget from './components/WeatherWidget';
import { sendMessageToGemini } from './services/geminiService';
import { Message, Coordinates, ViewMode, Place } from './types';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: "Hello! I'm your AI travel planner. I can help you plan trips using real-time information from Google Maps. \n\nWhere are you planning to go, and how many days will you be staying?",
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.SPLIT);
  
  // New state for map features
  const [mapPlaces, setMapPlaces] = useState<Place[]>([]);
  const [itinerary, setItinerary] = useState<Place[]>([]);
  const [isItineraryOpen, setIsItineraryOpen] = useState(true);

  // Filter and Sort state
  const [filterDay, setFilterDay] = useState<string>('all');
  const [sortBySequence, setSortBySequence] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          // Default to a known location if permission denied (e.g., San Francisco)
          setUserLocation({ lat: 37.7749, lng: -122.4194 });
        }
      );
    }
    
    // Handle responsive layout
    const handleResize = () => {
        if (window.innerWidth < 768) {
            if (viewMode === ViewMode.SPLIT) setViewMode(ViewMode.MOBILE_CHAT);
        } else {
            setViewMode(ViewMode.SPLIT);
        }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Derived state for weather
  const weatherCoordinates = useMemo(() => {
    // Priority 1: First place found in search results (the destination)
    if (mapPlaces.length > 0) {
        return { lat: mapPlaces[0].lat, lng: mapPlaces[0].lng };
    }
    // Priority 2: User's current location
    if (userLocation) {
        return userLocation;
    }
    return null;
  }, [mapPlaces, userLocation]);

  // Derived state for itinerary filtering and sorting
  const availableDays = useMemo(() => {
    const days = new Set<number>();
    itinerary.forEach(p => { if (p.day) days.add(p.day); });
    return Array.from(days).sort((a, b) => a - b);
  }, [itinerary]);

  const displayedItinerary = useMemo(() => {
    let result = [...itinerary];

    // Filter by day
    if (filterDay !== 'all') {
      const dayNum = parseInt(filterDay);
      result = result.filter(p => p.day === dayNum);
    }

    // Sort
    if (sortBySequence) {
      result.sort((a, b) => {
        // Sort by day first, then by order
        const dayA = a.day || 9999;
        const dayB = b.day || 9999;
        if (dayA !== dayB) return dayA - dayB;
        
        const orderA = a.order || 9999;
        const orderB = b.order || 9999;
        return orderA - orderB;
      });
    }

    return result;
  }, [itinerary, filterDay, sortBySequence]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    
    const newMessage: Message = { role: 'user', text: userText };
    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    try {
      const response = await sendMessageToGemini(messages, userText, userLocation || undefined);
      
      const botMessage: Message = {
        role: 'model',
        text: response.text,
        groundingChunks: response.groundingChunks
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      // Update map markers if places were returned
      if (response.places && response.places.length > 0) {
        setMapPlaces(response.places);
        // Switch to map view on mobile when new places are found
        if (window.innerWidth < 768) {
             setViewMode(ViewMode.FULL_MAP);
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error connecting to the travel service. Please try again.", isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const addToItinerary = (place: Place) => {
    if (!itinerary.some(p => p.name === place.name)) {
      setItinerary(prev => [...prev, place]);
      setIsItineraryOpen(true);
    }
  };

  const removeFromItinerary = (placeName: string) => {
    setItinerary(prev => prev.filter(p => p.name !== placeName));
  };

  return (
    <div className="flex h-screen w-screen bg-gray-50 overflow-hidden relative">
      
      {/* Map Area */}
      <div className={`absolute inset-0 md:relative md:w-1/2 lg:w-3/5 transition-all duration-300 ${
          viewMode === ViewMode.MOBILE_CHAT ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : 'opacity-100 z-10'
      }`}>
        <MapComponent 
            userLocation={userLocation} 
            places={mapPlaces}
            itinerary={itinerary}
            onAddToItinerary={addToItinerary}
        />
        
        {/* Weather Widget (Top Left, below title) */}
        {weatherCoordinates && (
            <div className="absolute top-16 left-4 z-[400]">
                <WeatherWidget lat={weatherCoordinates.lat} lng={weatherCoordinates.lng} />
            </div>
        )}

        {/* Itinerary Panel Overlay */}
        <div className={`absolute top-4 right-4 z-[500] transition-all duration-300 ${isItineraryOpen ? 'w-72' : 'w-auto'}`}>
             <div className="bg-white/95 backdrop-blur shadow-xl rounded-xl border border-gray-100 overflow-hidden flex flex-col max-h-[60vh]">
                <div 
                    className="p-3 bg-blue-600 text-white flex items-center justify-between cursor-pointer hover:bg-blue-700 transition-colors shrink-0"
                    onClick={() => setIsItineraryOpen(!isItineraryOpen)}
                >
                    <div className="flex items-center gap-2 font-medium text-sm">
                        <Calendar size={16} />
                        {isItineraryOpen && <span>My Itinerary ({itinerary.length})</span>}
                    </div>
                    {isItineraryOpen ? <X size={16} /> : <span className="text-xs font-bold px-1.5 py-0.5 bg-white/20 rounded">{itinerary.length}</span>}
                </div>
                
                {isItineraryOpen && (
                    <>
                    {/* Controls */}
                    <div className="p-2 border-b border-gray-100 bg-gray-50 flex gap-2 shrink-0">
                        <div className="relative flex-1">
                            <Filter size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                            <select 
                                value={filterDay}
                                onChange={(e) => setFilterDay(e.target.value)}
                                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:border-blue-400 text-gray-700 appearance-none cursor-pointer"
                            >
                                <option value="all">All Days</option>
                                {availableDays.map(d => (
                                    <option key={d} value={d}>Day {d}</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={() => setSortBySequence(!sortBySequence)}
                            className={`px-2 py-1.5 rounded border transition-colors flex items-center gap-1 text-xs font-medium ${
                                sortBySequence 
                                    ? 'bg-blue-100 text-blue-700 border-blue-200' 
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                            title="Sort by Sequence"
                        >
                            <ArrowUpDown size={14} />
                            {sortBySequence ? 'Seq' : 'Add'}
                        </button>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto p-2 scrollbar-hide">
                        {displayedItinerary.length === 0 ? (
                            <div className="text-center py-6 text-gray-400 text-xs">
                                {itinerary.length === 0 ? (
                                    <>
                                        <p>No places added yet.</p>
                                        <p>Click markers to add.</p>
                                    </>
                                ) : (
                                    <p>No places found for this filter.</p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {displayedItinerary.map((place, i) => (
                                    <div key={`${place.name}-${i}`} className="flex justify-between items-start gap-2 bg-gray-50 p-2 rounded border border-gray-100 text-sm group hover:border-blue-200 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 mb-0.5">
                                                {place.day && (
                                                    <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-1.5 rounded">D{place.day}</span>
                                                )}
                                                {place.order && (
                                                    <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 rounded">#{place.order}</span>
                                                )}
                                            </div>
                                            <div className="font-semibold text-gray-800 truncate">{place.name}</div>
                                            <div className="text-[10px] text-gray-500 truncate">{place.description}</div>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeFromItinerary(place.name); }}
                                            className="text-gray-400 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title="Remove"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    </>
                )}
             </div>
        </div>

        {/* Mobile Toggle Button (Floating when Map is active) */}
        <div className="absolute bottom-6 right-6 md:hidden z-[1000]">
             <button 
                onClick={() => setViewMode(ViewMode.MOBILE_CHAT)}
                className="bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition-colors flex items-center justify-center"
             >
                <MessageSquare className="w-6 h-6" />
             </button>
        </div>
        
        {/* Overlay Title for Map */}
        <div className="absolute top-4 left-4 md:left-1/2 md:transform md:-translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md z-[400] flex items-center gap-2 pointer-events-none">
            <Compass className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-700">Interactive Map</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className={`absolute inset-0 bg-white md:relative md:w-1/2 lg:w-2/5 flex flex-col shadow-2xl z-20 transition-transform duration-300 transform ${
         viewMode === ViewMode.MOBILE_CHAT ? 'translate-y-0' : 'translate-y-full md:translate-y-0'
      }`}>
        
        {/* Header */}
        <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
               TG
            </div>
            <div>
              <h1 className="font-bold text-gray-800">TravelGenie</h1>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Maps Grounding Active
              </p>
            </div>
          </div>
          
          {/* Mobile Map Toggle */}
          <button 
            onClick={() => setViewMode(ViewMode.FULL_MAP)}
            className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-full"
          >
            <MapIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Messages List */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50 scroll-smooth"
        >
          {messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm ml-4 mb-4 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Planning trip details...</span>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
          <div className="relative flex items-end gap-2 bg-gray-100 rounded-3xl p-2 border border-transparent focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about a destination, itinerary, or places to stay..."
              className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-2.5 px-3 text-gray-700 placeholder-gray-400 text-sm md:text-base scrollbar-hide"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className={`p-2.5 rounded-full shrink-0 mb-0.5 transition-all ${
                isLoading || !input.trim() 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:scale-105'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-2">
            AI can make mistakes. Please verify travel info.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;