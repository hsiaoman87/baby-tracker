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
  format,
  getHours,
  max,
  parse,
  startOfDay,
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

  get emoji() {
    return '';
  }

  get start() {
    return parseTime(this.row.timestamp);
  }

  get title() {
    return `${this.emoji}${this.text}`;
  }

  get text() {
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

  get emoji() {
    return '💩';
  }

  get text() {
    return '';
  }

  get type() {
    return EVENT_TYPES.POOP;
  }
}

function convertMinsToHrsMins(mins) {
  let h = Math.floor(mins / 60);
  let m = mins % 60;
  m = m < 10 ? '0' + m : m;
  return `${h}:${m}`;
}

function getAsleepTimeTitle(minutesAsleep) {
  return `asleep for ${convertMinsToHrsMins(minutesAsleep)}`;
}
export class AsleepActivityEvent extends ActivityEvent {
  get color() {
    return 'green';
  }

  get emoji() {
    return '😴';
  }

  get text() {
    if (this.end) {
      const minutesAsleep = differenceInMinutes(this.end, this.start);
      return getAsleepTimeTitle(minutesAsleep);
    } else {
      return `${super.text}`;
    }
  }

  get type() {
    return EVENT_TYPES.ASLEEP;
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

  get emoji() {
    return '😊';
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
    return _.sumBy(this.rows, row =>
      parseInt(row.activity.match(/\d+/)[0], 10)
    );
  }

  get color() {
    return 'purple';
  }

  get emoji() {
    return _.times(this.rows.length, _.constant('🍼')).join('');
  }

  get text() {
    return `took ${this.amount}`;
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

export class NextSleepActivityEvent extends ActivityEvent {
  AWAKE_DURATION = 2; // in hours
  BEDTIME = 22; // 10pm
  WAKETIME = 10; // 10am

  constructor(lastAwakeTime, now = new Date()) {
    super();
    const time = addHours(lastAwakeTime, this.AWAKE_DURATION);
    this._start = max(time, now);
  }

  get emoji() {
    return '💤';
  }

  get start() {
    return this._start;
  }

  get text() {
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

export class AllDayEvent {
  constructor(obj) {
    this.obj = obj;
  }

  toJson() {
    return this.obj;
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

  return { events, recent };
}

export function getEventsGroupedByDate(events) {
  return _.reduce(
    events,
    (acc, event) => {
      const startDate = format(event.start, 'YYYY-MM-DD');
      if (!acc[startDate]) {
        acc[startDate] = [];
      }
      acc[startDate].push(event);

      if (event.end) {
        const endDate = format(event.end, 'YYYY-MM-DD');
        if (startDate !== endDate) {
          if (!acc[endDate]) {
            acc[endDate] = [];
          }
          acc[endDate].push(event);
        }
      }

      return acc;
    },
    {}
  );
}

export function getTotalTimeAsleep(asleepEvents, date) {
  return _.reduce(
    asleepEvents,
    (acc, event) => {
      let timeAsleep;
      if (event.end) {
        let startTime;
        let endTime;
        if (format(event.start, 'YYYY-MM-DD') !== date) {
          // sleep from night before
          startTime = startOfDay(event.end);
          endTime = event.end;
        } else if (format(event.end, 'YYYY-MM-DD') !== date) {
          // tonight's sleep
          startTime = event.start;
          endTime = startOfDay(event.end);
        } else {
          // nap
          startTime = event.start;
          endTime = event.end;
        }
        timeAsleep = differenceInMinutes(endTime, startTime);
      } else {
        timeAsleep = 0;
      }
      return acc + timeAsleep;
    },
    0
  );
}

function getAllDayEvents(events) {
  // Use formatted dates here to represent all-day
  const eventsGroupedByDate = getEventsGroupedByDate(events);

  return _.flatMap(eventsGroupedByDate, (events, date) => {
    const groupedEvents = _.groupBy(events, _.property('type'));
    const allDayEvents = [];
    if (groupedEvents[EVENT_TYPES.POOP]) {
      const numPoops = groupedEvents[EVENT_TYPES.POOP].length;
      allDayEvents.push(
        new AllDayEvent({
          start: date,
          title: _.times(numPoops, _.constant('💩')).join(''),
          color: 'brown',
        })
      );
    }
    if (groupedEvents[EVENT_TYPES.ASLEEP]) {
      const totalTimeAsleep = getTotalTimeAsleep(
        groupedEvents[EVENT_TYPES.ASLEEP],
        date
      );
      if (totalTimeAsleep) {
        allDayEvents.push(
          new AllDayEvent({
            start: date,
            title: getAsleepTimeTitle(totalTimeAsleep),
            color: 'green',
          })
        );
      }
    }
    if (groupedEvents[EVENT_TYPES.EAT]) {
      const totalAmount = _.reduce(
        groupedEvents[EVENT_TYPES.EAT],
        (acc, event) => {
          let amount;
          if (event.amount) {
            amount = event.amount;
          } else {
            amount = 0;
          }
          return acc + amount;
        },
        0
      );
      if (totalAmount) {
        allDayEvents.push(
          new AllDayEvent({
            start: date,
            title: `🍼took ${totalAmount}`,
            color: 'purple',
          })
        );
      }
    }

    return allDayEvents;
  });
}

function getNextSleepEvent(recent) {
  if (
    recent[EVENT_TYPES.AWAKE] &&
    recent[EVENT_TYPES.ASLEEP] &&
    recent[EVENT_TYPES.AWAKE].start > recent[EVENT_TYPES.ASLEEP].start
  ) {
    return new NextSleepActivityEvent(recent[EVENT_TYPES.AWAKE].start);
  }
}

function App() {
  const [data, setData] = useState();

  useEffect(() => {
    async function fetchData() {
      const rows = await gsjson({
        spreadsheetId: process.env.REACT_APP_SPREADSHEET_ID,
      });

      const { events, recent } = processEvents(rows);

      const nextSleepEvent = getNextSleepEvent(recent);
      if (nextSleepEvent) {
        events.push(nextSleepEvent);
      }

      const allDayEvents = getAllDayEvents(events);

      const allEvents = events.concat(allDayEvents);

      setData(_.map(allEvents, event => event.toJson()));
    }

    fetchData();

    window.addEventListener('focus', fetchData);

    return () => {
      window.removeEventListener('focus', fetchData);
    };
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
