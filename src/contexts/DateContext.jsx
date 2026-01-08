import React, { createContext, useState, useContext } from 'react';
import { getLocalDate } from '../utils/helpers';

const DateContext = createContext();

export function useDate() {
  return useContext(DateContext);
}

export function DateProvider({ children }) {
  const [globalDate, setGlobalDate] = useState(getLocalDate());

  return (
    <DateContext.Provider value={{ globalDate, setGlobalDate }}>
      {children}
    </DateContext.Provider>
  );
}