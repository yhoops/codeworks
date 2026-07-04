import type { Prisma } from "@prisma/client";

export interface DomainEvent {
  type: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
  occurredAt: Date;
}

export type DomainEventInput = Omit<DomainEvent, "occurredAt"> & {
  occurredAt?: Date;
};

export type DomainEventHandler = (event: DomainEvent) => void | Promise<void>;

export interface DomainEventBuffer {
  record(event: DomainEventInput): void;
}

export interface TransactionHost {
  $transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T>;
}

export class DomainEventBus {
  private readonly handlers = new Map<string, Set<DomainEventHandler>>();

  subscribe(type: string, handler: DomainEventHandler): () => void {
    const handlers = this.handlers.get(type) ?? new Set<DomainEventHandler>();
    handlers.add(handler);
    this.handlers.set(type, handlers);

    return () => {
      handlers.delete(handler);
    };
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? new Set<DomainEventHandler>();

    for (const handler of handlers) {
      await handler(event);
    }
  }
}

export function createDomainEventBus(): DomainEventBus {
  return new DomainEventBus();
}

export class TransactionalDomainEvents {
  constructor(private readonly bus: DomainEventBus) {}

  async runInTransaction<T>(
    prisma: TransactionHost,
    callback: (
      tx: Prisma.TransactionClient,
      buffer: DomainEventBuffer
    ) => Promise<T>
  ): Promise<T> {
    const pendingEvents: DomainEvent[] = [];
    const result = await prisma.$transaction(async (tx) =>
      callback(tx, {
        record(event) {
          pendingEvents.push({
            ...event,
            occurredAt: event.occurredAt ?? new Date()
          });
        }
      })
    );

    for (const event of pendingEvents) {
      await this.bus.publish(event);
    }

    return result;
  }
}
