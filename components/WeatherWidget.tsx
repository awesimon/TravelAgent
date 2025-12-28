import React, { useEffect, useState } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Loader2 } from 'lucide-react';

interface WeatherWidgetProps {
    lat: number;
    lng: number;
}

interface WeatherData {
    temperature: number;
    weathercode: number;
    windspeed: number;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ lat, lng }) => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchWeather = async () => {
            setLoading(true);
            try {
                // Open-Meteo is a free weather API that requires no key
                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`
                );
                const data = await response.json();
                if (data.current_weather) {
                    setWeather(data.current_weather);
                }
            } catch (error) {
                console.error("Failed to fetch weather", error);
            } finally {
                setLoading(false);
            }
        };

        // Debounce slightly to prevent flickering if location updates rapidly
        const timer = setTimeout(fetchWeather, 500);
        return () => clearTimeout(timer);
    }, [lat, lng]);

    if (loading && !weather) return (
        <div className="bg-white/80 backdrop-blur p-2 rounded-xl shadow-md border border-gray-100 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-[10px] font-medium text-gray-500">Loading...</span>
        </div>
    );

    if (!weather) return null;

    const getWeatherIcon = (code: number) => {
        if (code === 0) return <Sun className="text-yellow-500 w-5 h-5" />;
        if (code >= 1 && code <= 3) return <Cloud className="text-gray-400 w-5 h-5" />;
        if (code >= 45 && code <= 48) return <Cloud className="text-gray-500 w-5 h-5" />;
        if (code >= 51 && code <= 67) return <CloudRain className="text-blue-400 w-5 h-5" />;
        if (code >= 71 && code <= 77) return <CloudSnow className="text-blue-200 w-5 h-5" />;
        if (code >= 80 && code <= 82) return <CloudRain className="text-blue-500 w-5 h-5" />;
        if (code >= 95) return <CloudLightning className="text-purple-500 w-5 h-5" />;
        return <Cloud className="text-gray-400 w-5 h-5" />;
    };

    const getWeatherLabel = (code: number) => {
        if (code === 0) return "Clear";
        if (code >= 1 && code <= 3) return "Cloudy";
        if (code >= 51 && code <= 67) return "Rain";
        if (code >= 71 && code <= 77) return "Snow";
        if (code >= 95) return "Storm";
        return "Overcast";
    };

    return (
        <div className="bg-white/90 backdrop-blur-md p-2.5 rounded-xl shadow-lg border border-gray-200 flex items-center gap-3 transition-all hover:scale-105 cursor-default group">
            <div className="flex items-center justify-center bg-blue-50 rounded-full w-9 h-9 shadow-sm group-hover:bg-blue-100 transition-colors">
                {getWeatherIcon(weather.weathercode)}
            </div>
            <div>
                <div className="flex items-baseline gap-1">
                     <span className="text-xl font-bold text-gray-800 leading-none">{Math.round(weather.temperature)}°</span>
                     <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{getWeatherLabel(weather.weathercode)}</span>
                </div>
                <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                    <Wind size={10} />
                    {weather.windspeed} km/h
                </div>
            </div>
        </div>
    );
};

export default WeatherWidget;