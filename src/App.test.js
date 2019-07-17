import React from 'react';
import ReactDOM from 'react-dom';
import App, {
  parseTime,
  ActivityEvent,
  PoopActivityEvent,
  AsleepActivityEvent,
  AwakeActivityEvent,
  EatActivityEvent,
  NextSleepActivityEvent,
  processEvents,
  getEventsGroupedByDate,
  getTotalTimeAsleep,
} from './App';

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

describe('ActivityEvent.create', () => {
  it('parses has pooped', () => {
    const event = ActivityEvent.create({ activity: 'has pooped' });
    expect(event).toBeInstanceOf(PoopActivityEvent);
  });

  it('parses asleep', () => {
    const event = ActivityEvent.create({ activity: 'is asleep' });
    expect(event).toBeInstanceOf(AsleepActivityEvent);
  });

  it('parses down', () => {
    const event = ActivityEvent.create({ activity: 'is down' });
    expect(event).toBeInstanceOf(AsleepActivityEvent);
  });

  it('parses awake', () => {
    const event = ActivityEvent.create({ activity: 'is awake' });
    expect(event).toBeInstanceOf(AwakeActivityEvent);
  });

  it('parses up', () => {
    const event = ActivityEvent.create({ activity: 'is up' });
    expect(event).toBeInstanceOf(AwakeActivityEvent);
  });

  it('parses eating', () => {
    const event = ActivityEvent.create({ activity: 'took 100' });
    expect(event).toBeInstanceOf(EatActivityEvent);
  });

  it('parses fallback', () => {
    const event = ActivityEvent.create({
      activity: 'laughed for the first time',
    });
    expect(event).toBeInstanceOf(ActivityEvent);
  });

  it('parses number', () => {
    const event = ActivityEvent.create({
      activity: 100,
    });
    expect(event).toBeInstanceOf(EatActivityEvent);
  });
});

describe('AsleepActivityEvent', () => {
  it('has correct titles for multiple events', () => {
    const event1 = ActivityEvent.create({
      timestamp: 'June 3, 2019 at 10:19AM',
      activity: 'is asleep',
    });
    const event2 = ActivityEvent.create({
      timestamp: 'June 3, 2019 at 12:00PM',
      activity: 'is awake',
    });
    event1.add(event2);
    expect(event1.title).toEqual('😴asleep for 1:41');
  });
});

describe('EatActivityEvent', () => {
  it('has correct titles for multiple events', () => {
    const event1 = new EatActivityEvent({ text: 'took 100' });
    const event2 = new EatActivityEvent({ text: 'took 200' });
    const event3 = new EatActivityEvent({ text: 'took 300' });
    event1.add(event2);
    event1.add(event3);
    expect(event1.title).toEqual('🍼🍼🍼took 600');
  });
});

describe('NextSleepActivityEvent', () => {
  it('has start time offset by 2.5 hours', () => {
    const event = new NextSleepActivityEvent(
      new Date(2019, 5, 6, 5, 19),
      new Date(2019, 5, 6, 6, 19)
    );
    expect(event.start).toEqual(new Date(2019, 5, 6, 7, 49));
  });

  it('has start time of now', () => {
    const event = new NextSleepActivityEvent(
      new Date(2019, 5, 6, 5, 19),
      new Date(2019, 5, 6, 9, 19)
    );
    expect(event.start).toEqual(new Date(2019, 5, 6, 9, 19));
  });

  it('has daytime title', () => {
    const event = new NextSleepActivityEvent(
      new Date(2019, 5, 6, 19, 19),
      new Date(2019, 5, 6, 19, 19)
    );
    expect(event.title).toEqual('💤Time for a nap! (awake for 2:30)');
  });

  it('has nighttime title', () => {
    const event = new NextSleepActivityEvent(
      new Date(2019, 5, 6, 20, 19),
      new Date(2019, 5, 6, 20, 19)
    );
    expect(event.title).toEqual('💤Time to sleep! (awake for 2:30)');
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
    const { events } = processEvents(rows);
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
    const { events } = processEvents(rows);
    expect(events).toHaveLength(2);
  });

  it('coalesces eat events', () => {
    const rows = [
      {
        timestamp: 'June 5, 2019 at 10:19AM',
        activity: 'took 100',
      },
      {
        timestamp: 'June 5, 2019 at 10:59AM',
        activity: 'took 100',
      },
    ];
    const { events } = processEvents(rows);
    expect(events).toHaveLength(1);
  });

  it('coalesces 2 of 3 eat events', () => {
    const rows = [
      {
        timestamp: 'June 5, 2019 at 10:19AM',
        activity: 'took 100',
      },
      {
        timestamp: 'June 5, 2019 at 10:49AM',
        activity: 'took 100',
      },
      {
        timestamp: 'June 5, 2019 at 11:39AM',
        activity: 'took 100',
      },
    ];
    const { events } = processEvents(rows);
    expect(events).toHaveLength(2);
  });

  it('does not coalesce eat events outside 1 hour', () => {
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
    const { events } = processEvents(rows);
    expect(events).toHaveLength(2);
  });

  it('does not coalesce events if it cannot', () => {
    const rows = [
      {
        timestamp: 'June 6, 2019 at 05:19AM',
        activity: 'is asleep',
      },
    ];
    const { events } = processEvents(rows);
    expect(events).toHaveLength(1);
  });
});

describe('getEventsGroupedByDate', () => {
  it('works across date boundaries', () => {
    const rows = [
      {
        timestamp: 'June 4, 2019 at 10:19PM',
        activity: 'asleep',
      },
      {
        timestamp: 'June 5, 2019 at 11:19AM',
        activity: 'awake',
      },
    ];
    const { events } = processEvents(rows);
    const eventsGroupedByDate = getEventsGroupedByDate(events);
    expect(eventsGroupedByDate).toEqual({
      '2019-06-04': [events[0]],
      '2019-06-05': [events[0]],
    });
  });
});

describe('getTotalTimeAsleep', () => {
  const rows = [
    {
      timestamp: 'June 4, 2019 at 10:19PM',
      activity: 'asleep',
    },
    {
      timestamp: 'June 5, 2019 at 11:19AM',
      activity: 'awake',
    },
  ];
  const { events } = processEvents(rows);

  it('works for last night sleep', () => {
    const totalTimeAsleep = getTotalTimeAsleep(events, '2019-06-04');
    expect(totalTimeAsleep).toEqual(101);
  });

  it('works for tonight sleep', () => {
    const totalTimeAsleep = getTotalTimeAsleep(events, '2019-06-05');
    expect(totalTimeAsleep).toEqual(679);
  });
});
