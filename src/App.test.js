import React from 'react';
import ReactDOM from 'react-dom';
import App, { EVENT_TYPES, parseTime, getType, processEvents } from './App';

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

describe('getType', () => {
  it('parses has pooped', () => {
    const type = getType('has pooped');
    expect(type).toEqual(EVENT_TYPES.POOP);
  });

  it('parses asleep', () => {
    const type = getType('is asleep');
    expect(type).toEqual(EVENT_TYPES.ASLEEP);
  });

  it('parses down', () => {
    const type = getType('is down');
    expect(type).toEqual(EVENT_TYPES.ASLEEP);
  });

  it('parses awake', () => {
    const type = getType('is awake');
    expect(type).toEqual(EVENT_TYPES.AWAKE);
  });

  it('parses up', () => {
    const type = getType('is up');
    expect(type).toEqual(EVENT_TYPES.AWAKE);
  });

  it('parses eating', () => {
    const type = getType('took 100');
    expect(type).toEqual(EVENT_TYPES.EAT);
  });

  it('parses fallback', () => {
    const type = getType('laughed for the first time');
    expect(type).toEqual(EVENT_TYPES.MISC);
  });
});

describe('processEvents', () => {
  it('coalesces dates', () => {
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

  it('does not coalesce dates outside 24 hours', () => {
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

  it('does not coalesce dates if it cannot', () => {
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
