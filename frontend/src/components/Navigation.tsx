import React from 'react';
import { NavLink } from 'react-router-dom';

interface NavigationProps {
  className?: string;
}

const Navigation: React.FC<NavigationProps> = ({ className = '' }) => {
  return (
    <nav className={`flex gap-1 bg-gray-50 p-1 rounded-xl ${className}`}>
      <NavLink 
        to="/"
        className={({ isActive }) => `
          px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
          ${isActive 
            ? 'bg-white text-gray-900 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
          }
        `}
      >
        Product
      </NavLink>
      <NavLink 
        to="/how-it-works"
        className={({ isActive }) => `
          px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
          ${isActive 
            ? 'bg-white text-gray-900 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
          }
        `}
      >
        How it Works
      </NavLink>
    </nav>
  );
};

export default Navigation; 