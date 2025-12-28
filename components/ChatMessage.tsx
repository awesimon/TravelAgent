import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { Bot, User, AlertCircle } from 'lucide-react';
import GroundingSource from './GroundingSource';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[85%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? 'bg-blue-600 text-white' : isError ? 'bg-red-100 text-red-600' : 'bg-green-600 text-white'
        }`}>
          {isUser ? <User size={16} /> : isError ? <AlertCircle size={16} /> : <Bot size={16} />}
        </div>

        {/* Bubble */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isUser 
              ? 'bg-blue-600 text-white rounded-tr-none' 
              : isError
                ? 'bg-red-50 border border-red-200 text-red-800 rounded-tl-none'
                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
          }`}>
            <ReactMarkdown 
                components={{
                    ul: ({node, ...props}) => <ul className="list-disc ml-4 my-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal ml-4 my-2" {...props} />,
                    strong: ({node, ...props}) => <span className="font-bold text-blue-700 bg-blue-50 px-1 rounded" {...props} />,
                    h3: ({node, ...props}) => <h3 className="font-bold text-lg mt-3 mb-1" {...props} />,
                }}
            >
                {message.text}
            </ReactMarkdown>
          </div>

          {/* Grounding Sources (Map Chips) */}
          {!isUser && message.groundingChunks && message.groundingChunks.length > 0 && (
            <div className="mt-3 w-full max-w-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                References found on Maps
              </p>
              <div className="grid grid-cols-1 gap-1">
                {message.groundingChunks.map((chunk, idx) => (
                  <GroundingSource key={idx} chunk={chunk} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;