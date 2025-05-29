import React, { useState, useEffect, useRef } from 'react';
import { PRVersions } from '../types';
import DocumentDiffViewer from './DocumentDiffViewer';
import VersionRangeSlider from './VersionRangeSlider';

interface PressReleaseEvolutionProps {
  versions: PRVersions;
}

const PressReleaseEvolution: React.FC<PressReleaseEvolutionProps> = ({ versions }) => {
  const [fromVersion, setFromVersion] = useState(1);
  const [toVersion, setToVersion] = useState(2);
  const [selectedVersion, setSelectedVersion] = useState(2);
  const [showRedlines, setShowRedlines] = useState(true);
  
  // Ref to track the previous state of showRedlines
  const prevShowRedlinesRef = useRef(showRedlines);
  
  const versionInfo = [
    { num: 1, label: 'Initial Draft', subtitle: 'Market Research + Problem Discovery', key: 'v1_draft' },
    { num: 2, label: 'VP Refined', subtitle: 'Executive Feedback', key: 'v2_refined' },
    { num: 3, label: 'Customer Validated', subtitle: 'User Research Integration', key: 'v3_validated' },
    { num: 4, label: 'Final', subtitle: 'Complete Synthesis', key: 'v4_final' }
  ];
  
  const availableVersions = versionInfo.filter(v => 
    versions[v.key as keyof PRVersions]
  );

  // Update slider states when redlines toggle
  useEffect(() => {
    const showRedlinesToggled = prevShowRedlinesRef.current !== showRedlines;

    if (showRedlinesToggled) {
      if (!showRedlines) {
        // When redlines are turned OFF
        setSelectedVersion(fromVersion); // Set selectedVersion to the 'from' part of the previous range
      } else {
        // When redlines are turned ON
        // Use the current selectedVersion (from single mode) as the new fromVersion
        const newFrom = selectedVersion;
        let newTo = selectedVersion; // Default to selectedVersion

        const availableNums = availableVersions.map(v => v.num).sort((a, b) => a - b);
        // const currentSelectedIndexInAvailable = availableNums.indexOf(newFrom); // Not directly used in this exact copied logic block below

        if (availableVersions.length > 0) {
          const currentSelectedIdx = availableNums.indexOf(newFrom);
          if (availableNums.length === 1) {
            newTo = newFrom; // Only one version available
          } else if (currentSelectedIdx !== -1 && currentSelectedIdx < availableNums.length - 1) {
            // If current 'newFrom' is not the last available version, set 'newTo' to the next available.
            newTo = availableNums[currentSelectedIdx + 1];
          } else if (currentSelectedIdx > 0) {
            // If current 'newFrom' is the last available version (and not the only version),
            // set 'fromVersion' to the previous available and 'toVersion' to 'newFrom' (current selectedVersion).
            setFromVersion(availableNums[currentSelectedIdx - 1]);
            setToVersion(newFrom);
            // Update ref here before early return if state setters are not batched in a way that current render sees new showRedlines
            // prevShowRedlinesRef.current = showRedlines; // Actually, this should be at the end of effect
            return; // States are set, exit.
          } else {
             // Fallback: not found, or selectedVersion was first and no others after.
             // Or newFrom is the only version.
            newTo = newFrom;
          }
          setFromVersion(newFrom);
          setToVersion(newTo);
        } else { // No available versions
          setFromVersion(1); // Fallback
          setToVersion(versionInfo.length > 0 ? Math.min(2, versionInfo.length) : 1); // Fallback
        }
      }
    }

    // Update the ref to the current showRedlines value for the next render.
    prevShowRedlinesRef.current = showRedlines;

  }, [showRedlines, fromVersion, selectedVersion, availableVersions, versionInfo]); // Dependencies adjusted

  const handleRangeChange = (from: number, to: number) => {
    setFromVersion(from);
    setToVersion(to);
  };

  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
  };
  
  return (
    <div className="bg-white rounded-xl p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Press Release Evolution</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showRedlines}
              onChange={(e) => setShowRedlines(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-10 h-6 rounded-full transition-colors ${
              showRedlines ? 'bg-black' : 'bg-gray-300'
            }`}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform mt-1 ${
                showRedlines ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </div>
            <span className="text-sm font-medium">Show Redlines</span>
          </label>
        </div>
        
        {/* Version Range Slider */}
        <VersionRangeSlider
          versionInfo={versionInfo}
          availableVersions={availableVersions}
          fromVersion={fromVersion}
          toVersion={toVersion}
          selectedVersion={selectedVersion}
          mode={showRedlines ? 'compare' : 'single'}
          onRangeChange={handleRangeChange}
          onVersionChange={handleVersionChange}
        />
      </div>
      
      {/* Document Viewer */}
      <DocumentDiffViewer
        versions={versions}
        fromVersion={fromVersion}
        toVersion={showRedlines ? toVersion : selectedVersion}
        showRedlines={showRedlines}
      />
      
      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => {
            if (showRedlines) {
              if (fromVersion > 1) {
                const newFrom = fromVersion - 1;
                setFromVersion(newFrom);
                setToVersion(fromVersion);
              }
            } else {
              if (selectedVersion > 1) {
                setSelectedVersion(selectedVersion - 1);
              }
            }
          }}
          disabled={showRedlines ? fromVersion <= 1 : selectedVersion <= 1}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous {showRedlines ? 'Change' : 'Version'}
        </button>
        <button
          onClick={() => {
            if (showRedlines) {
              if (toVersion < 4 && versions[versionInfo[toVersion].key as keyof PRVersions]) {
                setFromVersion(toVersion);
                setToVersion(toVersion + 1);
              }
            } else {
              if (selectedVersion < 4 && versions[versionInfo[selectedVersion].key as keyof PRVersions]) {
                setSelectedVersion(selectedVersion + 1);
              }
            }
          }}
          disabled={showRedlines 
            ? toVersion >= 4 || !versions[versionInfo[toVersion].key as keyof PRVersions]
            : selectedVersion >= 4 || !versions[versionInfo[selectedVersion].key as keyof PRVersions]
          }
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next {showRedlines ? 'Change' : 'Version'} →
        </button>
      </div>
    </div>
  );
};

export default PressReleaseEvolution; 