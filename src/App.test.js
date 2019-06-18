import React from 'react';
import ReactDOM from 'react-dom';
import App, { EVENT_TYPES, parseTime, getEvent, processEvents } from './App';

it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<App />, div);
  ReactDOM.unmountComponentAtNode(div);
});

describe('parseTime', () => {
  it('parses AM', () => {
    const time = parseTime('June 6, 2019 at 05:19AM');
    expect(time).toEqual(new Date(2019, 5, 6, 5, 19));
  });

  it('parses PM', () => {
    const time = parseTime('June 6, 2019 at 05:19PM');
    expect(time).toEqual(new Date(2019, 5, 6, 17, 19));
  });
});

describe('getEvent', () => {
  it('parses has pooped', () => {
    const event = getEvent({ activity: 'has pooped' });
    expect(event.type).toEqual(EVENT_TYPES.POOP);
  });

  it('parses asleep', () => {
    const event = getEvent({ activity: 'is asleep' });
    expect(event.type).toEqual(EVENT_TYPES.ASLEEP);
  });

  it('parses down', () => {
    const event = getEvent({ activity: 'is down' });
    expect(event.type).toEqual(EVENT_TYPES.ASLEEP);
  });

  it('parses awake', () => {
    const event = getEvent({ activity: 'is awake' });
    expect(event.type).toEqual(EVENT_TYPES.AWAKE);
  });

  it('parses up', () => {
    const event = getEvent({ activity: 'is up' });
    expect(event.type).toEqual(EVENT_TYPES.AWAKE);
  });

  it('parses eating', () => {
    const event = getEvent({ activity: 'took 100' });
    expect(event.type).toEqual(EVENT_TYPES.EAT);
  });

  it('parses fallback', () => {
    const event = getEvent({ activity: 'laughed for the first time' });
    expect(event.type).toEqual(EVENT_TYPES.MISC);
  });
});

describe('processEvents', () => {
  it('coalesces sleep events', () => {
    const rows = [
      {
        timestamp: 'June 5, 2019 at 10:19PM',
        activity: 'is asleep',
      },
      {
        timestamp: 'June 6, 2019 at 05:19AM',
        activity: 'is awake',
      },
    ];
    const events = processEvents(rows);
    expect(events).toHaveLength(1);
  });

  it('does not coalesce sleep events outside 24 hours', () => {
    const rows = [
      {
        timestamp: 'June 3, 2019 at 10:19PM',
        activity: 'is asleep',
      },
      {
        timestamp: 'June 6, 2019 at 05:19AM',
        activity: 'is awake',
      },
    ];
    const events = processEvents(rows);
    expect(events).toHaveLength(2);
  });

  it('coalesces eat events', () => {
    const rows = [
      {
        timestamp: 'June 5, 2019 at 10:19PM',
        activity: 'took 100',
      },
      {
        timestamp: 'June 5, 2019 at 10:59AM',
        activity: 'took 100',
      },
    ];
    const events = processEvents(rows);
    expect(events).toHaveLength(1);
  });

  it('does not eat events outside 1 hour', () => {
    const rows = [
      {
        timestamp: 'June 5, 2019 at 10:19AM',
        activity: 'took 100',
      },
      {
        timestamp: 'June 5, 2019 at 11:19AM',
        activity: 'took 100',
      },
    ];
    const events = processEvents(rows);
    expect(events).toHaveLength(2);
  });

  it('does not coalesce events if it cannot', () => {
    const rows = [
      {
        timestamp: 'June 6, 2019 at 05:19AM',
        activity: 'is asleep',
      },
    ];
    const events = processEvents(rows);
    expect(events).toHaveLength(1);
  });
});
