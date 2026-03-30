import { Poller, PollerDeps } from '../../../src/poller/poller';

describe('Poller', () => {
  let deps: PollerDeps;
  let poller: Poller;

  beforeEach(() => {
    deps = {
      fetchPage: jest.fn().mockResolvedValue({ events: [{ id: '1' }], nextToken: 'tok2', isCaughtUp: true }),
      transform: jest.fn().mockReturnValue('CEF:0|test'),
      ingest: jest.fn().mockResolvedValue({ accepted: true, chunksSubmitted: 1 }),
      stateStore: {
        load: jest.fn().mockResolvedValue({}),
        save: jest.fn().mockResolvedValue(undefined),
      } as any,
      intervalMs: 60000,
    };
    poller = new Poller(deps);
  });

  afterEach(() => {
    poller.stop();
  });

  it('should fetch, transform, and ingest a single page', async () => {
    await poller.tick();
    expect(deps.fetchPage).toHaveBeenCalledWith(undefined);
    expect(deps.transform).toHaveBeenCalledWith([{ id: '1' }]);
    expect(deps.ingest).toHaveBeenCalledWith('CEF:0|test');
    expect(deps.stateStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ lastPageToken: 'tok2', lastEventCount: 1 }),
    );
  });

  it('should skip ingest when no events', async () => {
    (deps.fetchPage as jest.Mock).mockResolvedValue({ events: [], nextToken: undefined, isCaughtUp: true });
    await poller.tick();
    expect(deps.transform).not.toHaveBeenCalled();
    expect(deps.ingest).not.toHaveBeenCalled();
  });

  it('should use lastPageToken from state', async () => {
    (deps.stateStore.load as jest.Mock).mockResolvedValue({ lastPageToken: 'saved-token' });
    await poller.tick();
    expect(deps.fetchPage).toHaveBeenCalledWith('saved-token');
  });

  it('should log errors from tick without crashing', async () => {
    (deps.fetchPage as jest.Mock).mockRejectedValue(new Error('Network error'));
    // tick should not throw — it logs and continues
    await expect(poller.tick()).resolves.toBeUndefined();
  });

  it('should start and run first tick immediately', async () => {
    await poller.start();
    expect(deps.fetchPage).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('should process multiple pages per tick', async () => {
    (deps.fetchPage as jest.Mock)
      .mockResolvedValueOnce({ events: [{ id: '1' }], nextToken: 'tok2', isCaughtUp: false })
      .mockResolvedValueOnce({ events: [{ id: '2' }], nextToken: 'tok3', isCaughtUp: true });

    await poller.tick();
    expect(deps.fetchPage).toHaveBeenCalledTimes(2);
    expect(deps.transform).toHaveBeenCalledTimes(2);
    expect(deps.ingest).toHaveBeenCalledTimes(2);
    expect(deps.stateStore.save).toHaveBeenCalledTimes(2);
  });

  it('should checkpoint state after each page', async () => {
    (deps.fetchPage as jest.Mock)
      .mockResolvedValueOnce({ events: [{ id: '1' }], nextToken: 'tok2', isCaughtUp: false })
      .mockResolvedValueOnce({ events: [{ id: '2' }], nextToken: 'tok3', isCaughtUp: true });

    await poller.tick();
    expect(deps.stateStore.save).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ lastPageToken: 'tok2' }),
    );
    expect(deps.stateStore.save).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ lastPageToken: 'tok3' }),
    );
  });

  it('should not run concurrent ticks', async () => {
    let resolveFirst: () => void;
    (deps.fetchPage as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = () => resolve({ events: [{ id: '1' }], nextToken: 'tok', isCaughtUp: true });
      }),
    );

    const tickPromise = poller.tick();
    await poller.tick();
    expect(deps.fetchPage).toHaveBeenCalledTimes(1);

    resolveFirst!();
    await tickPromise;
  });

  it('should stop cleanly when timer is set', async () => {
    await poller.start();
    poller.stop();
    poller.stop();
  });
});
