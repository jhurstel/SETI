import React from 'react';
import ReactDOM from 'react-dom/client';
import { BoardUI } from './ui/BoardUI';
import './ui/styles.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <BoardUI/>
  </React.StrictMode>
);
