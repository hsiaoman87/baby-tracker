import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import gsjson from 'google-spreadsheet-to-json';
import * as _ from 'lodash-es';
import { differenceInHours, parse } from 'date-fns';

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

export function getType(activity) {
  let type;

  if (activity.match(/poop/)) {
    type = EVENT_TYPES.POOP;
  } else if (activity.match(/asleep|down/)) {
    type = EVENT_TYPES.ASLEEP;
  } else if (activity.match(/awake|up/)) {
    type = EVENT_TYPES.AWAKE;
  } else if (activity.match(/\d+/)) {
    type = EVENT_TYPES.EAT;
  } else {
    type = EVENT_TYPES.MISC;
  }

  return type;
}

export function processEvents(rows) {
  // assume list is sorted
  // decorate with type and parse timestamp
  const events = _.reduce(
    rows,
    (acc, row) => {
      const timestamp = parseTime(row.timestamp);
      const type = getType(row.activity);

      if (type === EVENT_TYPES.AWAKE) {
        const lastAsleepEvent = _.findLast(
          acc,
          event => event.type === EVENT_TYPES.ASLEEP
        );
        if (
          lastAsleepEvent &&
          differenceInHours(timestamp, lastAsleepEvent.start) < 24
        ) {
          lastAsleepEvent.end = timestamp;
        } else {
          acc.push({
            title: row.activity,
            start: timestamp,
            type,
          });
        }
      } else {
        acc.push({
          title: row.activity,
          start: timestamp,
          type,
        });
      }

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
