import { promises as fs } from 'fs';
import * as path from 'path';
import { getLogger } from '../shared/logger';

export interface PollerState {
  lastPageToken?: string;
  lastPollTime?: string;
  lastEventCount?: number;
}

export class StateStore {
  private readonly filePath: string;

  constructor(filePath: string = path.join(process.cwd(), 'state', 'poller-state.json')) {
    this.filePath = filePath;
  }

  async load(): Promise<PollerState> {
    const logger = getLogger();
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data) as PollerState;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No existing state file, starting fresh');
        return {};
      }
      throw err;
    }
  }

  async save(state: PollerState): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tempPath, this.filePath);
  }
}
