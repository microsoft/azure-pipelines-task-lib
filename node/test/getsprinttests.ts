import * as assert from 'assert';
import * as tl from '../_build/task';

describe('GetSprint Tests', () => {
    it('returns sprint 1 week 1 for sprint one start date', () => {
        const result = tl.getSprint(new Date(Date.UTC(2010, 7, 14, 0, 0, 0, 0)));
        assert.deepStrictEqual(result, { sprint: 1, week: 1 });
    });

    it('returns sprint 0 week 3 for the day before sprint one', () => {
        const result = tl.getSprint(new Date(Date.UTC(2010, 7, 13, 12, 0, 0, 0)));
        assert.deepStrictEqual(result, { sprint: 0, week: 3 });
    });

    it('returns sprint 272 week 1 for 2026-03-19', () => {
        const result = tl.getSprint(new Date(Date.UTC(2026, 2, 19, 12, 0, 0, 0)));
        assert.deepStrictEqual(result, { sprint: 272, week: 1 });
    });
});
