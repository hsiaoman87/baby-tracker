import React, { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
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
    const start = parseTime(row.timestamp);
    const text = String(row.activity);
    if (text.match(/poo/)) {
      return new PoopActivityEvent({ start, text });
    } else if (text.match(/sleep|down/)) {
      return new AsleepActivityEvent({ start, text });
    } else if (text.match(/wake|up/)) {
      return new AwakeActivityEvent({ start, text });
    } else if (text.match(/took \d+/) || !isNaN(Number(text))) {
      return new EatActivityEvent({ start, text });
    } else {
      return new ActivityEvent({ start, text });
    }
  }

  constructor(obj) {
    this.obj = obj;
  }

  get color() {
    return this.obj.color;
  }

  get emoji() {
    return this.obj.emoji || '';
  }

  get start() {
    return this.obj.start;
  }

  get title() {
    return `${this.emoji}${this.text}`;
  }

  get text() {
    return this.obj.text || '';
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

function getAwakeTimeTitle(minutesAwake) {
  return `awake for ${convertMinsToHrsMins(minutesAwake)}`;
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
      return super.text;
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
  constructor(obj) {
    super();
    this.objs = [obj];
  }

  get obj() {
    return this.objs[0];
  }

  set obj(obj) {}

  get amount() {
    return _.sumBy(this.objs, obj => parseInt(obj.text.match(/\d+/)[0], 10));
  }

  get color() {
    return 'purple';
  }

  get emoji() {
    return _.times(this.objs.length, _.constant('🍼')).join('');
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
    this.objs.push(event.obj);
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
  AWAKE_DURATION = 2.5; // in hours
  BEDTIME = 22; // 10pm
  WAKETIME = 10; // 10am

  constructor(lastAwakeTime, now = new Date()) {
    super();
    this._lastAwakeTime = lastAwakeTime;
    const time = addHours(lastAwakeTime, this.AWAKE_DURATION);
    this._start = max(time, now);
  }

  get color() {
    return 'green';
  }

  get emoji() {
    return '💤';
  }

  get start() {
    return this._start;
  }

  get text() {
    const minutesAwake = differenceInMinutes(this.start, this._lastAwakeTime);
    const awakeText = getAwakeTimeTitle(minutesAwake);
    const hours = getHours(this.start);
    if (hours >= this.BEDTIME || hours < this.WAKETIME) {
      return `Time to sleep! (${awakeText})`;
    } else {
      return `Time for a nap! (${awakeText})`;
    }
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
          return acc;
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
        new ActivityEvent({
          emoji: _.times(numPoops, _.constant('💩')).join(''),
          start: date,
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
        const numNaps = groupedEvents[EVENT_TYPES.ASLEEP].length;
        allDayEvents.push(
          new ActivityEvent({
            emoji: _.times(numNaps, _.constant('😴')).join(''),
            start: date,
            text: getAsleepTimeTitle(totalTimeAsleep),
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
        const numEats = groupedEvents[EVENT_TYPES.EAT].length;
        allDayEvents.push(
          new ActivityEvent({
            emoji: _.times(numEats, _.constant('🍼')).join(''),
            start: date,
            text: `took ${totalAmount}`,
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
  const calendarRef = useRef();

  useEffect(() => {
    async function fetchData() {
      const response = await fetch(
        process.env.REACT_APP_GOOGLE_SPREADSHEET_JSON_URL
      );

      const rows = await response.json();

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

  const handleGoto = () => {
    const currentDate = calendarRef.current.calendar.getDate();

    const dateString = prompt('Enter a date:', format(currentDate, 'M/D/YY'));
    if (dateString) {
      const date = parse(dateString);
      calendarRef.current.calendar.gotoDate(date);
    }
  };

  return (
    <div className="root">
      <FullCalendar
        defaultView="listDay"
        height="parent"
        navLinks
        timeGridEventMinHeight={40}
        nowIndicator
        header={{
          left: 'prev,next today goto',
          center: 'title',
          right: 'timeGridWeek,timeGridDay,listDay',
        }}
        customButtons={{
          goto: { text: 'jump', click: handleGoto },
        }}
        plugins={[listPlugin, timeGridPlugin]}
        events={data}
        ref={calendarRef}
      />
    </div>
  );
}

export default App;
