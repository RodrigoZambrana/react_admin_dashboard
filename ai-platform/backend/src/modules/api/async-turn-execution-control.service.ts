import { Injectable } from '@nestjs/common';

@Injectable()
export class AsyncTurnExecutionControlService {
  private readonly controllers = new Map<string, AbortController>();

  acquire(turnId: string) {
    const controller = new AbortController();
    this.controllers.set(turnId, controller);

    return {
      signal: controller.signal,
      release: () => {
        const current = this.controllers.get(turnId);

        if (current === controller) {
          this.controllers.delete(turnId);
        }
      },
    };
  }

  cancel(turnId: string, reason = 'Async turn was superseded by a newer inbound message.') {
    const controller = this.controllers.get(turnId);

    if (!controller) {
      return false;
    }

    controller.abort(reason);
    return true;
  }
}
