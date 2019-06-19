import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import gsjson from 'google-spreadsheet-to-json';
import * as _ from 'lodash-es';
import {
  addHours,
  differenceInHours,
  differenceInMinutes,
  getHours,
  max,
  parse,
} from 'date-fns';

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

export class ActivityEvent {
  static create(row) {
    if (row.activity.match(/poop/)) {
      return new PoopActivityEvent(row);
    } else if (row.activity.match(/asleep|down/)) {
      return new AsleepActivityEvent(row);
    } else if (row.activity.match(/awake|up/)) {
      return new AwakeActivityEvent(row);
    } else if (row.activity.match(/\d+/)) {
      return new EatActivityEvent(row);
    } else {
      return new ActivityEvent(row);
    }
  }

  constructor(row) {
    this.row = row;
  }

  get start() {
    return parseTime(this.row.timestamp);
  }

  get title() {
    return this.row.activity;
  }

  get type() {
    return EVENT_TYPES.MISC;
  }

  canCoalesce(event) {
    return false;
  }

  toJson() {
    return {
      start: this.start,
      title: this.title,
      color: this.color,
    };
  }
}

export class PoopActivityEvent extends ActivityEvent {
  get color() {
    return 'brown';
  }

  get title() {
    return `💩${super.title}`;
  }

  get type() {
    return EVENT_TYPES.POOP;
  }
}

export class AsleepActivityEvent extends ActivityEvent {
  get color() {
    return 'green';
  }

  get title() {
    if (this.end) {
      const minutesAsleep = differenceInMinutes(this.end, this.start);
      return `😴 asleep for ${this.convertMinsToHrsMins(minutesAsleep)}`;
    } else {
      return `😴${super.title}`;
    }
  }

  get type() {
    return EVENT_TYPES.ASLEEP;
  }

  convertMinsToHrsMins(mins) {
    let h = Math.floor(mins / 60);
    let m = mins % 60;
    m = m < 10 ? '0' + m : m;
    return `${h}:${m}`;
  }

  canCoalesce(event) {
    return differenceInHours(event.start, this.start) < 24;
  }

  add(event) {
    this.end = event.start;
  }

  toJson() {
    return {
      ...super.toJson(),
      end: this.end,
    };
  }
}

export class AwakeActivityEvent extends ActivityEvent {
  get color() {
    return 'green';
  }

  get title() {
    return `😊${super.title}`;
  }

  get type() {
    return EVENT_TYPES.AWAKE;
  }
}

export class EatActivityEvent extends ActivityEvent {
  constructor(row) {
    super();
    this.rows = [row];
  }

  get row() {
    return this.rows[0];
  }

  set row(row) {}

  get amount() {
    return _.sumBy(this.rows, row => parseInt(row.activity.match(/\d+/)[0]));
  }

  get color() {
    return 'purple';
  }

  get title() {
    const emojis = _.times(this.rows.length, () => '🍼').join('');
    return `${emojis}took ${this.amount}`;
  }

  get type() {
    return EVENT_TYPES.EAT;
  }

  canCoalesce(event) {
    return differenceInMinutes(event.start, this.start) < 60;
  }

  add(event) {
    this.rows.push(event.row);
    this.end = event.start;
  }

  toJson() {
    return {
      ...super.toJson(),
      amount: this.amount,
      end: this.end,
    };
  }
}

export class NextSleepActivityEvent {
  AWAKE_DURATION = 2; // in hours
  BEDTIME = 22; // 10pm
  WAKETIME = 10; // 10am

  constructor(lastAwakeTime, now = new Date()) {
    const time = addHours(lastAwakeTime, this.AWAKE_DURATION);
    this.start = max(time, now);
  }

  get title() {
    const hours = getHours(this.start);
    if (hours >= this.BEDTIME || hours < this.WAKETIME) {
      return 'Time to sleep!';
    } else {
      return 'Time for a nap!';
    }
  }

  toJson() {
    return {
      start: this.start,
      title: this.title,
      color: 'green',
    };
  }
}

export function processEvents(rows) {
  const recent = {};

  // assume list is sorted
  const events = _.reduce(
    rows,
    (acc, row) => {
      const event = ActivityEvent.create(row);

      if (event instanceof AwakeActivityEvent) {
        const lastAsleepEvent = recent[EVENT_TYPES.ASLEEP];
        if (lastAsleepEvent && lastAsleepEvent.canCoalesce(event)) {
          lastAsleepEvent.add(event);
        } else {
          acc.push(event);
        }
      } else if (event instanceof EatActivityEvent) {
        const lastEatEvent = recent[EVENT_TYPES.EAT];
        if (lastEatEvent && lastEatEvent.canCoalesce(event)) {
          lastEatEvent.add(event);
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

  return { events: events.map(event => event.toJson()), recent };
}

function App() {
  const [data, setData] = useState();

  useEffect(() => {
    async function fetchData() {
      const rows = await gsjson({
        spreadsheetId: process.env.REACT_APP_SPREADSHEET_ID,
      });

      const { events, recent } = processEvents(rows);

      if (
        recent[EVENT_TYPES.AWAKE] &&
        recent[EVENT_TYPES.ASLEEP] &&
        recent[EVENT_TYPES.AWAKE].start > recent[EVENT_TYPES.ASLEEP].start
      ) {
        events.push(
          new NextSleepActivityEvent(recent[EVENT_TYPES.AWAKE].start).toJson()
        );
      }

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
        nowIndicator
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
