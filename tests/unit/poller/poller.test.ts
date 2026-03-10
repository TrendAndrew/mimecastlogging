import { Poller, PollerDeps } from '../../../src/poller/poller';

describe('Poller', () => {
  let deps: PollerDeps;
  let poller: Poller;

  beforeEach(() => {
    deps = {
      fetchEvents: jest.fn().mockResolvedValue({ events: [{ id: '1' }], nextToken: 'tok2' }),
      transform: jest.fn().mockReturnValue('{"id":"1"}'),
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

  it('should execute a full tick cycle', async () => {
    await poller.tick();
    expect(deps.fetchEvents).toHaveBeenCalledWith(undefined);
    expect(deps.transform).toHaveBeenCalledWith([{ id: '1' }]);
    expect(deps.ingest).toHaveBeenCalledWith('{"id":"1"}');
    expect(deps.stateStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ lastPageToken: 'tok2', lastEventCount: 1 }),
    );
  });

  it('should skip ingest when no events', async () => {
    (deps.fetchEvents as jest.Mock).mockResolvedValue({ events: [], nextToken: undefined });
    await poller.tick();
    expect(deps.transform).not.toHaveBeenCalled();
    expect(deps.ingest).not.toHaveBeenCalled();
  });

  it('should use lastPageToken from state', async () => {
    (deps.stateStore.load as jest.Mock).mockResolvedValue({ lastPageToken: 'saved-token' });
    await poller.tick();
    expect(deps.fetchEvents).toHaveBeenCalledWith('saved-token');
  });

  it('should propagate errors from tick', async () => {
    (deps.fetchEvents as jest.Mock).mockRejectedValue(new Error('Network error'));
    await expect(poller.tick()).rejects.toThrow('Network error');
  });
});
