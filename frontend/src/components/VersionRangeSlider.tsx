import React, { useState, useRef, useEffect, useCallback } from 'react';

interface VersionInfo {
  num: number;
  label: string;
  subtitle: string;
  key: string;
}

interface VersionRangeSliderProps {
  versionInfo: VersionInfo[];
  availableVersions: VersionInfo[];
  fromVersion: number;
  toVersion: number;
  selectedVersion?: number;
  mode: 'compare' | 'single';
  onRangeChange: (from: number, to: number) => void;
  onVersionChange: (version: number) => void;
}

const VersionRangeSlider: React.FC<VersionRangeSliderProps> = ({
  versionInfo,
  availableVersions,
  fromVersion,
  toVersion,
  selectedVersion = toVersion,
  mode,
  onRangeChange,
  onVersionChange,
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'from' | 'to' | 'single' | null>(null);

  // Get position percentage for a version number
  const getPositionForVersion = (version: number): number => {
    const maxVersion = Math.max(...versionInfo.map(v => v.num));
    const minVersion = Math.min(...versionInfo.map(v => v.num));
    return ((version - minVersion) / (maxVersion - minVersion)) * 100;
  };

  // Get version number from position percentage
  const getVersionFromPosition = (percentage: number): number => {
    const maxVersion = Math.max(...versionInfo.map(v => v.num));
    const minVersion = Math.min(...versionInfo.map(v => v.num));
    const rawVersion = minVersion + (percentage / 100) * (maxVersion - minVersion);
    
    // Snap to nearest available version
    let nearestVersion = Math.round(rawVersion);
    nearestVersion = Math.max(minVersion, Math.min(maxVersion, nearestVersion));
    
    // Ensure the version is available
    const isAvailable = availableVersions.some(v => v.num === nearestVersion);
    if (!isAvailable) {
      // Find the nearest available version
      const availableNums = availableVersions.map(v => v.num).sort((a, b) => a - b);
      nearestVersion = availableNums.reduce((prev, curr) => 
        Math.abs(curr - rawVersion) < Math.abs(prev - rawVersion) ? curr : prev
      );
    }
    
    return nearestVersion;
  };

  // Handle mouse/touch events
  const handlePointerDown = (e: React.PointerEvent, handleType: 'from' | 'to' | 'single') => {
    e.preventDefault();
    setIsDragging(handleType);
    
    // Capture pointer for smooth dragging
    if (e.currentTarget instanceof Element) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const newVersion = getVersionFromPosition(percentage);

    if (mode === 'single') {
      onVersionChange(newVersion);
    } else {
      if (isDragging === 'from') {
        const newTo = Math.max(newVersion, toVersion);
        onRangeChange(newVersion, newTo);
      } else if (isDragging === 'to') {
        const newFrom = Math.min(fromVersion, newVersion);
        onRangeChange(newFrom, newVersion);
      }
    }
  }, [isDragging, mode, fromVersion, toVersion, onRangeChange, onVersionChange]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Track click on slider track
  const handleTrackClick = (e: React.MouseEvent) => {
    if (!sliderRef.current || isDragging) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = ((e.clientX - rect.left) / rect.width) * 100;
    const clickedVersion = getVersionFromPosition(percentage);

    if (mode === 'single') {
      onVersionChange(clickedVersion);
    } else {
      // For compare mode, determine which handle to move based on proximity
      const distanceToFrom = Math.abs(getPositionForVersion(fromVersion) - percentage);
      const distanceToTo = Math.abs(getPositionForVersion(toVersion) - percentage);
      
      if (distanceToFrom < distanceToTo) {
        const newTo = Math.max(clickedVersion, toVersion);
        onRangeChange(clickedVersion, newTo);
      } else {
        const newFrom = Math.min(fromVersion, clickedVersion);
        onRangeChange(newFrom, clickedVersion);
      }
    }
  };

  // Set up global pointer event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      
      return () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const fromPosition = getPositionForVersion(fromVersion);
  const toPosition = getPositionForVersion(toVersion);
  const singlePosition = getPositionForVersion(selectedVersion);

  return (
    <div className="mb-6">
      {/* Slider Container */}
      <div 
        ref={sliderRef}
        className="relative h-12 bg-gray-100 rounded-lg cursor-pointer select-none"
        onClick={handleTrackClick}
      >
        {/* Track Fill */}
        {mode === 'compare' ? (
          <div 
            className="absolute top-0 bottom-0 bg-blue-200 rounded-lg transition-all duration-200"
            style={{
              left: `${Math.min(fromPosition, toPosition)}%`,
              width: `${Math.abs(toPosition - fromPosition)}%`
            }}
          />
        ) : (
          <div 
            className="absolute top-0 bottom-0 rounded-lg transition-all duration-200"
            style={{
              left: '0%',
              width: '0%',
              backgroundColor: 'transparent'
            }}
          />
        )}

        {/* Version Markers */}
        {versionInfo.map((version) => {
          const position = getPositionForVersion(version.num);
          const isAvailable = availableVersions.some(v => v.num === version.num);
          
          return (
            <div
              key={version.num}
              className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${position}%` }}
            >
              <div 
                className={`w-3 h-3 rounded-full border-2 ${
                  isAvailable 
                    ? 'bg-white border-gray-400' 
                    : 'bg-gray-200 border-gray-300'
                }`}
              />
            </div>
          );
        })}

        {/* Handles */}
        {mode === 'compare' ? (
          <>
            {/* From Handle */}
            <div
              className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing"
              style={{ left: `${fromPosition}%` }}
              onPointerDown={(e) => handlePointerDown(e, 'from')}
            >
              <div className="w-6 h-6 bg-blue-500 border-2 border-white rounded-full shadow-lg hover:scale-110 transition-transform">
                <div className="absolute -bottom-7 left-1/2 transform -translate-x-1/2 text-xs text-blue-500 font-medium whitespace-nowrap">
                  From
                </div>
              </div>
            </div>

            {/* To Handle */}
            <div
              className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing"
              style={{ left: `${toPosition}%` }}
              onPointerDown={(e) => handlePointerDown(e, 'to')}
            >
              <div className="w-6 h-6 bg-green-500 border-2 border-white rounded-full shadow-lg hover:scale-110 transition-transform">
                <div className="absolute -bottom-7 left-1/2 transform -translate-x-1/2 text-xs text-green-500 font-medium whitespace-nowrap">
                  To
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Single Handle */
          <div
            className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing"
            style={{ left: `${singlePosition}%` }}
            onPointerDown={(e) => handlePointerDown(e, 'single')}
          >
            <div className="w-6 h-6 bg-blue-500 border-2 border-white rounded-full shadow-lg hover:scale-110 transition-transform">
              <div className="absolute -bottom-7 left-1/2 transform -translate-x-1/2 text-xs text-blue-500 font-medium whitespace-nowrap">
                View
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Version Labels */}
      <div className="relative mt-8 h-16">
        {versionInfo.map((version) => {
          const isAvailable = availableVersions.some(v => v.num === version.num);
          const position = getPositionForVersion(version.num);
          
          // Smart alignment based on position to prevent overflow
          const getAlignmentClasses = () => {
            if (position === 0) {
              // Left edge - align left
              return "absolute flex flex-col items-start text-left transform translate-x-0";
            } else if (position === 100) {
              // Right edge - align right
              return "absolute flex flex-col items-end text-right transform -translate-x-full";
            } else {
              // Center positions - center align
              return "absolute flex flex-col items-center text-center transform -translate-x-1/2";
            }
          };
          
          return (
            <div 
              key={version.num} 
              className={getAlignmentClasses()}
              style={{ left: `${position}%` }}
            >
              <span className={`text-xs font-medium ${
                isAvailable ? 'text-gray-700' : 'text-gray-400'
              }`}>
                v{version.num}
              </span>
              <span className={`text-xs mt-1 ${
                isAvailable ? 'text-gray-600' : 'text-gray-400'
              }`}>
                {version.label}
              </span>
              <span className={`text-xs ${
                isAvailable ? 'text-gray-400' : 'text-gray-300'
              }`}>
                {version.subtitle}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current Selection Display */}
      <div className="text-center text-sm text-gray-600 mt-4">
        {mode === 'compare' 
          ? `Comparing: v${fromVersion} → v${toVersion}`
          : `Viewing: v${selectedVersion}`
        }
      </div>
    </div>
  );
};

export default VersionRangeSlider; 