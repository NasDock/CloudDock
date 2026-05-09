declare module 'tuntap2' {
  import { EventEmitter } from 'events';

  export class Tun extends EventEmitter {
    name: string;
    ipv4: string;
    mtu: number;
    isUp: boolean;

    constructor();
    write(data: Buffer): void;
    release(): void;
  }
}
