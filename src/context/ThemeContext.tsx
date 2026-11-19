import React, { createContext, useContext, useEffect, useState } from 'react';
import { availableThemes } from '../data/scheduleData';
import { StorageService } from '../services/storage';
import { AppTheme } from '../types/attendance';

interface ThemeContextType {
  activeTheme: AppTheme;
  adminDefaultThemeId: string;
  userThemeId: string | null;
  setUserTheme: (themeId: string) => void;
  setAdminDefaultTheme: (themeId: string) => void;
  allThemes: AppTheme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminDefaultThemeId, setAdminDefaultThemeIdState] = useState<string>('theme-emerald');
  const [userThemeId, setUserThemeIdState] = useState<string | null>(null);

  useEffect(() => {
    const settings = StorageService.getSettings();
    if (settings.defaultThemeId) {
      setAdminDefaultThemeIdState(settings.defaultThemeId);
    }
    const savedUserTheme = StorageService.getUserTheme();
    if (savedUserTheme) {
      setUserThemeIdState(savedUserTheme);
    }
  }, []);

  // Determine active theme: user preference takes precedence; fallback to admin default
  const effectiveThemeId = userThemeId || adminDefaultThemeId;
  const activeTheme =
    availableThemes.find((t) => t.id === effectiveThemeId) || availableThemes[0];

  // Set user preference (student choice)
  const setUserTheme = (themeId: string) => {
    setUserThemeIdState(themeId);
    StorageService.saveUserTheme(themeId);
  };

  // Set administrator school default
  const setAdminDefaultTheme = (themeId: string) => {
    setAdminDefaultThemeIdState(themeId);
    const settings = StorageService.getSettings();
    settings.defaultThemeId = themeId;
    StorageService.saveSettings(settings);
  };

  // Sync to root HTML attribute and CSS variables
  useEffect(() => {
    document.documentElement.setAttribute('data-app-theme', activeTheme.id);
    document.documentElement.style.setProperty('--color-primary', activeTheme.previewColor);
  }, [activeTheme]);

  return (
    <ThemeContext.Provider
      value={{
        activeTheme,
        adminDefaultThemeId,
        userThemeId,
        setUserTheme,
        setAdminDefaultTheme,
        allThemes: availableThemes,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
