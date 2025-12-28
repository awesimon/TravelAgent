import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Tooltip } from 'react-leaflet';
import { Coordinates, Place, PlaceType } from '../types';
import { Plus, Check, CalendarDays, Bed, Utensils, Bus, Camera, MapPin, Footprints } from 'lucide-react';
import L from 'leaflet';

// Use CDN URLs for default markers as fallback
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
    iconUrl: iconUrl,
    iconRetinaUrl: iconRetinaUrl,
    shadowUrl: shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const ROUTE_COLORS = [
    '#2563eb', // Blue (Day 1)
    '#dc2626', // Red (Day 2)
    '#16a34a', // Green (Day 3)
    '#d97706', // Amber (Day 4)
    '#9333ea', // Purple (Day 5)
    '#db2777', // Pink (Day 6)
];

interface MapComponentProps {
  userLocation: Coordinates | null;
  places: Place[];
  itinerary: Place[];
  onAddToItinerary: (place: Place) => void;
}

// Extended interface for places with view-specific data
interface ProcessedPlace extends Place {
  dayIndex?: number;
}

interface RouteSegment {
    day: number;
    positions: [number, number][];
    color: string;
    isTransit: boolean;
    id: string;
}

// Helper to get icon string based on type
const getIconSvg = (type: PlaceType | undefined, color: string, indexStr: string) => {
    let iconSvg = '';
    
    // SVG Templates
    const baseStyle = `width: 20px; height: 20px; color: white;`;
    
    switch (type) {
        case 'hotel':
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="${baseStyle}"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`;
            break;
        case 'food':
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="${baseStyle}"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`;
            break;
        case 'transit':
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="${baseStyle}"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>`;
            break;
        case 'attraction':
        default:
             // Use number for generic attractions
            return `<div style="color: white; font-weight: 800; font-size: 14px; font-family: sans-serif;">${indexStr}</div>`;
    }
    
    return iconSvg;
};

// Function to create custom numbered/icon marker
const createCustomIcon = (place: Place, index: number, color: string) => {
  const indexStr = place.order ? place.order.toString() : index.toString();
  const innerContent = getIconSvg(place.type, color, indexStr);
  const isTransit = place.type === 'transit';
  
  // Transit stops are smaller squares, others are larger pins
  const size = isTransit ? 28 : 36;
  const borderRadius = isTransit ? '6px' : '50%';
  const border = isTransit ? '2px solid white' : '3px solid white';

  return L.divIcon({
    className: 'custom-place-marker',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
      ">
        <div style="
            background-color: ${color};
            width: ${size}px;
            height: ${size}px;
            border-radius: ${borderRadius};
            border: ${border};
            box-shadow: 0 3px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
            position: relative;
        ">
            ${innerContent}
        </div>
        ${!isTransit ? `
        <div style="
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 8px solid ${color};
            z-index: 5;
        "></div>` : ''}
      </div>
    `,
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, size + 10],
    popupAnchor: [0, -(size + 10)],
    tooltipAnchor: [0, 0],
  });
};

const MapController: React.FC<{ center: Coordinates, places: Place[] }> = ({ center, places }) => {
  const map = useMap();
  
  useEffect(() => {
    if (places.length === 1) {
        const place = places[0];
        const targetZoom = place.zoom || 14;
        map.flyTo([place.lat, place.lng], targetZoom, {
            duration: 1.5,
            easeLinearity: 0.25
        });
    } else if (places.length > 1) {
      const bounds = L.latLngBounds(places.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15, animate: true, duration: 1.5 });
    }
  }, [places, map]);
  
  useEffect(() => {
      map.setView([center.lat, center.lng], 13);
  }, []); 

  return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ userLocation, places, itinerary, onAddToItinerary }) => {
  const defaultCenter = { lat: 51.505, lng: -0.09 };
  const center = userLocation || defaultCenter;

  const { routeSegments, processedPlaces } = useMemo(() => {
    const grouped: Record<number, Place[]> = {};
    
    // 1. Group places by day
    places.forEach(p => {
        if (p.day) {
            if (!grouped[p.day]) grouped[p.day] = [];
            grouped[p.day].push(p);
        }
    });
    
    // 2. Create Route Segments (for visual distinction of transit)
    const segments: RouteSegment[] = [];

    Object.entries(grouped).forEach(([dayStr, dayPlaces]) => {
        const day = parseInt(dayStr);
        const color = ROUTE_COLORS[(day - 1) % ROUTE_COLORS.length];
        
        // Sort by order
        const sortedPlaces = dayPlaces.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        for (let i = 0; i < sortedPlaces.length - 1; i++) {
            const p1 = sortedPlaces[i];
            const p2 = sortedPlaces[i+1];
            
            // Logic: If p1 is transit, assume p1->p2 is transit
            const isTransit = p1.type === 'transit';
            
            segments.push({
                day,
                positions: [[p1.lat, p1.lng], [p2.lat, p2.lng]],
                color,
                isTransit,
                id: `${day}-${i}`
            });
        }
    });

    // 3. Process for display
    const dayCounters: Record<number, number> = {};
    const processed: ProcessedPlace[] = places.map(p => {
        let index = 0;
        if (p.day) {
            if (!dayCounters[p.day]) dayCounters[p.day] = 0;
            dayCounters[p.day]++;
            index = dayCounters[p.day];
        }
        return { ...p, dayIndex: index };
    });

    return { routeSegments: segments, processedPlaces: processed };
  }, [places]);

  return (
    <MapContainer 
      center={[center.lat, center.lng]} 
      zoom={13} 
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapController center={center} places={places} />

      {/* Routes Segments */}
      {routeSegments.map((segment) => (
         <React.Fragment key={segment.id}>
             {/* White Halo for contrast */}
             <Polyline 
                positions={segment.positions}
                pathOptions={{ 
                    color: 'white', 
                    weight: segment.isTransit ? 8 : 7, 
                    opacity: 0.8,
                    lineCap: 'round',
                    lineJoin: 'round'
                }}
             />
             {/* Actual Route Line */}
             <Polyline 
                positions={segment.positions}
                pathOptions={{ 
                    color: segment.color, 
                    weight: segment.isTransit ? 5 : 4, 
                    opacity: 1,
                    // Solid line for transit, Dotted line for standard/walking
                    // '1, 10' creates a nice dotted effect with lineCap: 'round'
                    dashArray: segment.isTransit ? undefined : '1, 10', 
                    lineCap: 'round'
                }}
             >
                <Popup className="font-semibold text-sm">
                   <div className="flex flex-col gap-1">
                       <div className="flex items-center gap-2">
                           {segment.isTransit ? (
                               <>
                                   <Bus size={14} className="text-gray-600"/>
                                   <span>Public Transport</span>
                               </>
                           ) : (
                               <>
                                   <Footprints size={14} className="text-gray-600"/>
                                   <span>Walking / Travel</span>
                               </>
                           )}
                       </div>
                       <span className="text-xs text-gray-500">Day {segment.day} Route</span>
                   </div>
                </Popup>
             </Polyline>
         </React.Fragment>
      ))}

      {/* User Location */}
      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {/* Places */}
      {processedPlaces.map((place, idx) => {
        const isAdded = itinerary.some(p => p.name === place.name);
        
        // Color logic
        let dayColor = '#666';
        if (place.day) {
            dayColor = ROUTE_COLORS[(place.day - 1) % ROUTE_COLORS.length];
        }

        const customIcon = createCustomIcon(place, place.dayIndex || 1, dayColor);

        return (
          <Marker key={`${place.name}-${idx}`} position={[place.lat, place.lng]} icon={customIcon}>
            <Tooltip 
                direction="bottom" 
                offset={[0, 10]} 
                opacity={1} 
                permanent 
                className="custom-tooltip"
            >
                <div className="font-bold text-xs text-gray-800 bg-white/95 px-2 py-0.5 rounded shadow-sm border border-gray-200 -mt-1 flex items-center gap-1">
                    {place.day ? <span className="text-[10px] uppercase text-gray-400">D{place.day}</span> : null}
                    {place.name}
                </div>
            </Tooltip>

            <Popup>
              <div className="p-1 min-w-[200px]">
                {place.day && (
                    <div 
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white mb-2"
                        style={{ backgroundColor: dayColor }}
                    >
                        <CalendarDays size={10} />
                        Day {place.day} • {place.type === 'transit' ? 'Transit Node' : `Stop ${place.order || place.dayIndex}`}
                    </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                     {place.type === 'hotel' && <Bed size={16} className="text-blue-600"/>}
                     {place.type === 'food' && <Utensils size={16} className="text-orange-600"/>}
                     {place.type === 'transit' && <Bus size={16} className="text-green-600"/>}
                     <h3 className="font-bold text-gray-800">{place.name}</h3>
                </div>
                
                <p className="text-sm text-gray-600 mb-3 line-clamp-3">{place.description}</p>
                <button 
                  onClick={() => onAddToItinerary(place)}
                  disabled={isAdded}
                  className={`w-full py-1.5 px-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    isAdded 
                      ? 'bg-green-100 text-green-700 cursor-default' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isAdded ? (
                    <><Check size={14} /> Added</>
                  ) : (
                    <><Plus size={14} /> Add to Itinerary</>
                  )}
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default MapComponent;