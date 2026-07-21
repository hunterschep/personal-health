import { formatInTimeZone } from "./timezone";

export interface Clock {
  today(timezone: string): string;
  now(): Date;
}

export class SystemClock implements Clock {
  today(timezone: string): string {
    return formatInTimeZone(new Date(), timezone);
  }

  now(): Date {
    return new Date();
  }
}

export class TestClock implements Clock {
  readonly #instant: Date;

  constructor(instant: Date | string) {
    this.#instant = new Date(instant);
    if (Number.isNaN(this.#instant.valueOf())) {
      throw new TypeError("TestClock requires a valid date.");
    }
  }

  today(timezone: string): string {
    return formatInTimeZone(this.#instant, timezone);
  }

  now(): Date {
    return new Date(this.#instant);
  }
}
