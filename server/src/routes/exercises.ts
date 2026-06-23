import { Router, Request, Response } from 'express';
import { Exercise } from '../models/Exercise';

const router = Router();

/**
 * GET /api/exercises
 * List exercises with optional filtering.
 * Query params:
 *   - category: filter by workout category (e.g., "strength", "hypertrophy")
 *   - muscle_group: filter by primary muscle group
 *   - equipment: filter by required equipment
 *   - location: filter by compatible location
 *   - difficulty: filter by difficulty level
 *   - search: text search on exercise name
 *   - limit: max results (default 50, max 100)
 *   - offset: pagination offset (default 0)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      muscle_group,
      equipment,
      location,
      difficulty,
      search,
      limit = '50',
      offset = '0',
    } = req.query;

    const filter: Record<string, any> = {};

    if (category && typeof category === 'string') {
      filter.category_tags = category;
    }

    if (muscle_group && typeof muscle_group === 'string') {
      filter['muscle_groups.primary'] = muscle_group;
    }

    if (equipment && typeof equipment === 'string') {
      filter.equipment_required = equipment;
    }

    if (location && typeof location === 'string') {
      filter.location_compatible = location;
    }

    if (difficulty && typeof difficulty === 'string') {
      filter.difficulty_level = difficulty;
    }

    if (search && typeof search === 'string') {
      filter.name = { $regex: search, $options: 'i' };
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);
    const parsedOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

    const [exercises, total] = await Promise.all([
      Exercise.find(filter)
        .sort({ name: 1 })
        .skip(parsedOffset)
        .limit(parsedLimit)
        .lean(),
      Exercise.countDocuments(filter),
    ]);

    res.json({
      exercises,
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        has_more: parsedOffset + parsedLimit < total,
      },
    });
  } catch (error: any) {
    console.error('Exercise list error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch exercises' });
  }
});

/**
 * GET /api/exercises/:id
 * Get a single exercise by exercise_id (the string ID, not MongoDB _id).
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const exercise = await Exercise.findOne({ exercise_id: id }).lean();

    if (!exercise) {
      res.status(404).json({ error: 'Not Found', message: 'Exercise not found' });
      return;
    }

    res.json(exercise);
  } catch (error: any) {
    console.error('Exercise detail error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch exercise' });
  }
});

export default router;
