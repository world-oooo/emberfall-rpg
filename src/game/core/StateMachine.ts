/** Minimal typed finite state machine. Transitions requested during enter/exit are deferred to the next update. */
export interface State<TOwner> {
  enter?(owner: TOwner, from: string | null, data?: unknown): void;
  update?(owner: TOwner, delta: number): void;
  exit?(owner: TOwner, to: string): void;
}

export class StateMachine<TOwner, TName extends string = string> {
  private readonly states = new Map<TName, State<TOwner>>();
  private current: TName | null = null;
  private pending: { name: TName; data?: unknown } | null = null;
  private transitioning = false;
  /** ms spent in the current state */
  public elapsed = 0;

  constructor(private readonly owner: TOwner) {}

  add(name: TName, state: State<TOwner>): this {
    this.states.set(name, state);
    return this;
  }

  get name(): TName | null {
    return this.current;
  }

  is(name: TName): boolean {
    return this.current === name;
  }

  set(name: TName, data?: unknown): void {
    if (!this.states.has(name)) throw new Error(`Unknown state "${name}"`);
    if (this.transitioning) {
      this.pending = { name, data };
      return;
    }
    this.transitioning = true;
    const from = this.current;
    if (from !== null) this.states.get(from)?.exit?.(this.owner, name);
    this.current = name;
    this.elapsed = 0;
    this.states.get(name)?.enter?.(this.owner, from, data);
    this.transitioning = false;
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      this.set(p.name, p.data);
    }
  }

  update(delta: number): void {
    if (this.current === null) return;
    this.elapsed += delta;
    this.states.get(this.current)?.update?.(this.owner, delta);
  }
}
