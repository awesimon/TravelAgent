import React from 'react';
import { GroundingChunk } from '../types';
import { MapPin, Star } from 'lucide-react';

interface GroundingSourceProps {
  chunk: GroundingChunk;
}

const GroundingSource: React.FC<GroundingSourceProps> = ({ chunk }) => {
  if (chunk.maps) {
    const { maps } = chunk;
    return (
      <a 
        href={maps.uri} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block bg-white border border-gray-200 rounded-lg p-3 hover:bg-blue-50 transition-colors shadow-sm mb-2"
      >
        <div className="flex items-start gap-3">
          <div className="bg-red-100 p-2 rounded-full mt-1 shrink-0">
             <MapPin className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 text-sm">{maps.title}</h4>
            <p className="text-xs text-gray-500 mt-0.5">View on Google Maps</p>
          </div>
        </div>
      </a>
    );
  }
  
  if (chunk.web) {
    return (
        <a 
        href={chunk.web.uri} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block bg-white border border-gray-200 rounded-lg p-3 hover:bg-blue-50 transition-colors shadow-sm mb-2"
      >
        <div className="flex items-start gap-3">
          <div className="bg-blue-100 p-2 rounded-full mt-1 shrink-0">
             <Star className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 text-sm">{chunk.web.title}</h4>
            <p className="text-xs text-gray-500 mt-0.5">Source: Web</p>
          </div>
        </div>
      </a>
    );
  }

  return null;
};

export default GroundingSource;