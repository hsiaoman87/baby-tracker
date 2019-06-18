import React, { useEffect, useState } from 'react';
import gsjson from 'google-spreadsheet-to-json';

import logo from './logo.svg';
import './App.css';

function App() {
  const [data, setData] = useState();

  useEffect(() => {
    async function fetchData() {
      const spreadsheet = await gsjson({
        spreadsheetId: process.env.REACT_APP_SPREADSHEET_ID,
      });

      setData(spreadsheet);
    }

    fetchData();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
