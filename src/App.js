import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import gsjson from 'google-spreadsheet-to-json';
import * as _ from 'lodash-es';
import { differenceInHours, differenceInMinutes, parse } from 'date-fns';

import './App.css';

export const EVENT_TYPES = {
  POOP: 'POOP',
  ASLEEP: 'ASLEEP',
  AWAKE: 'AWAKE',
  EAT: 'EAT',
  MISC: 'MISC',
};

export function parseTime(timestamp) {
  let time = timestamp;

  time = _.replace(time, ' at ', ' ');
  time = _.replace(time, 'AM', ' AM');
  time = _.replace(time, 'PM', ' PM');

  return parse(time);
}

export function getEvent(row) {
  // decorate with type and parse timestamp
  const start = parseTime(row.timestamp);

  let title;
  let type;
  let amount;
  let color;

  if (row.activity.match(/poop/)) {
    title = `💩${row.activity}`;
    type = EVENT_TYPES.POOP;
    color = 'brown';
  } else if (row.activity.match(/asleep|down/)) {
    title = `😴${row.activity}`;
    type = EVENT_TYPES.ASLEEP;
    color = 'green';
  } else if (row.activity.match(/awake|up/)) {
    title = `😊${row.activity}`;
    type = EVENT_TYPES.AWAKE;
    color = 'green';
  } else if (row.activity.match(/\d+/)) {
    title = `🍼${row.activity}`;
    type = EVENT_TYPES.EAT;
    amount = parseInt(row.activity.match(/\d+/)[0]);
    color = 'purple';
  } else {
    title = row.activity;
    type = EVENT_TYPES.MISC;
  }

  return {
    start,
    title,
    type,
    amount,
    color,
  };
}

export function processEvents(rows) {
  const recent = {};

  // assume list is sorted
  const events = _.reduce(
    rows,
    (acc, row) => {
      const event = getEvent(row);

      if (event.type === EVENT_TYPES.AWAKE) {
        const lastAsleepEvent = recent[EVENT_TYPES.ASLEEP];
        if (
          lastAsleepEvent &&
          differenceInHours(event.start, lastAsleepEvent.start) < 24
        ) {
          lastAsleepEvent.end = event.start;
        } else {
          acc.push(event);
        }
      } else if (event.type === EVENT_TYPES.EAT) {
        const lastEatEvent = recent[EVENT_TYPES.EAT];
        if (
          lastEatEvent &&
          differenceInMinutes(event.start, lastEatEvent.start) < 60
        ) {
          lastEatEvent.end = event.start;
          lastEatEvent.amount += event.amount;
          lastEatEvent.title = `🍼🍼took ${lastEatEvent.amount}`;
        } else {
          acc.push(event);
        }
      } else {
        acc.push(event);
      }
      recent[event.type] = event;

      return acc;
    },
    []
  );

  return events;
}

function App() {
  const [data, setData] = useState();

  useEffect(() => {
    async function fetchData() {
      const rows = await gsjson({
        spreadsheetId: process.env.REACT_APP_SPREADSHEET_ID,
      });

      const events = processEvents(rows);

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
        timeGridEventMinHeight={40}
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
