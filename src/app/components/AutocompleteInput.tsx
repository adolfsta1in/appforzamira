import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useDebounce } from '@/hooks/useDebounce';

interface AutocompleteInputProps {
  columnName: string;
  isMultiline: boolean;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function AutocompleteInput({
  columnName,
  isMultiline,
  value,
  onChange,
  onFocus,
  onMouseDown,
  placeholder,
  style,
  className,
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const debouncedValue = useDebounce(value, 300);

  useEffect(() => {
    // Only fetch if we have some text to search
    if (debouncedValue && debouncedValue.length > 1 && isOpen) {
      const fetchSuggestions = async () => {
        const { data, error } = await supabase
          .from('certificates')
          .select(columnName)
          .ilike(columnName, `%${debouncedValue}%`)
          .limit(50);
          
        if (data && !error) {
          // Extract string values, remove nulls/empties, and deduplicate
          const rows = data as unknown as Record<string, string>[];
          const uniqueVals = Array.from(
            new Set(rows.map(row => row[columnName]).filter(Boolean))
          ).slice(0, 10); // Limit to 10 distinct
          
          setSuggestions(uniqueVals);
        }
      };
      fetchSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [debouncedValue, columnName, isOpen]);

  // Handle clicking outside to close the dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
    if (onFocus) onFocus();
  };

  const commonProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value);
      setIsOpen(true);
    },
    onFocus: handleFocus,
    onMouseDown,
    placeholder,
    className,
  };

  return (
    <div 
      ref={wrapperRef} 
      style={{ 
        position: 'relative', 
        width: style?.width, 
        height: style?.height, 
        zIndex: isOpen && suggestions.length > 0 ? 1000 : 'auto' 
      }}
    >
      {isMultiline ? (
        <textarea {...commonProps} style={{ ...style, position: 'relative', top: 0, left: 0, width: '100%', height: '100%' }} />
      ) : (
        <input type="text" {...commonProps} style={{ ...style, position: 'relative', top: 0, left: 0, width: '100%', height: '100%' }} />
      )}
      
      {isOpen && suggestions.length > 0 && (
        <ul 
          className="no-print"
          style={{ 
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '2px',
            minWidth: '100%', 
            width: 'max-content',
            maxWidth: '500px',
            maxHeight: '240px',
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            zIndex: 9999,
            listStyle: 'none',
            padding: 0,
            margin: '2px 0 0 0',
          }}
        >
          {suggestions.map((suggestion, idx) => (
            <li
              key={idx}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(suggestion); }}
              style={{ 
                padding: '8px 12px',
                fontSize: '13px',
                color: '#1f2937',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                fontFamily: 'Arial, sans-serif',
                wordBreak: 'break-word',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
