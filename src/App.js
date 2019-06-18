import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import gsjson from 'google-spreadsheet-to-json';
import * as _ from 'lodash-es';
import { parse } from 'date-fns';

import './App.css';

function App() {
  const [data, setData] = useState();

  useEffect(() => {
    async function fetchData() {
      const spreadsheet = await gsjson({
        spreadsheetId: process.env.REACT_APP_SPREADSHEET_ID,
      });

      const events = _.map(spreadsheet, row => {
        let date = row.timestamp;
        date = _.replace(date, ' at ', ' ');
        date = _.replace(date, 'AM', ' AM');
        date = _.replace(date, 'PM', ' PM');

        return {
          title: row.activity,
          start: parse(date),
        };
      });

      setData(events);
    }

    fetchData();
  }, []);

  return (
    <div className="root">
      <FullCalendar
        defaultView="listDay"
        height="parent"
        navLinks
        header={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridWeek,timeGridDay,listDay',
        }}
        plugins={[listPlugin, timeGridPlugin]}
        events={data}
      />
    </div>
  );
}

export default App;
