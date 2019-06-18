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

  if (row.activity.match(/poop/)) {
    title = `💩${row.activity}`;
    type = EVENT_TYPES.POOP;
  } else if (row.activity.match(/asleep|down/)) {
    title = `😴${row.activity}`;
    type = EVENT_TYPES.ASLEEP;
  } else if (row.activity.match(/awake|up/)) {
    title = `😊${row.activity}`;
    type = EVENT_TYPES.AWAKE;
  } else if (row.activity.match(/\d+/)) {
    title = `🍼${row.activity}`;
    type = EVENT_TYPES.EAT;
    amount = parseInt(row.activity.match(/\d+/)[0]);
  } else {
    title = row.activity;
    type = EVENT_TYPES.MISC;
  }

  return {
    start,
    title,
    type,
    amount,
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

      // decorate event sources
      const groups = _.groupBy(events, 'type');
      const eventSources = _.map(groups, (events, type) => {
        let eventSource = { events };

        switch (type) {
          case EVENT_TYPES.POOP:
            eventSource.color = 'brown';
            break;
          case EVENT_TYPES.ASLEEP:
          case EVENT_TYPES.AWAKE:
            eventSource.color = 'green';
            break;
          case EVENT_TYPES.EAT:
            eventSource.color = 'purple';
            break;
          default:
            break;
        }

        return eventSource;
      });

      setData(eventSources);
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
        eventSources={data}
      />
    </div>
  );
}

export default App;
