#!/usr/bin/env node
import assert from 'assert';
import {
  generateSubCategory,
  getSubcategoriesForCategory,
  getAllSubcategories,
} from '../services/ml/subcategoryGenerator.js';

(async function runTests() {
  try {
    console.log('Running subcategoryGenerator unit tests...');

    // 1) Study -> AI & Machine Learning (phrase match)
    let out = await generateSubCategory({ title: 'Study machine learning', category: 'study_and_education' });
    assert.strictEqual(out.label, 'AI & Machine Learning', `Expected 'AI & Machine Learning', got '${out.label}'`);
    assert.ok(out.confidence > 0 && out.confidence <= 1);

    // 2) Family -> Family Call (keyword: call mom)
    out = await generateSubCategory({ title: 'Call mom', category: 'family' });
    assert.strictEqual(out.label, 'Family Call');

    // 3) Workout -> Gym Session (case + punctuation)
    out = await generateSubCategory({ title: 'GO TO GYM!!!', category: 'workout' });
    assert.strictEqual(out.label, 'Gym Session');

    // 4) Manual override respected
    out = await generateSubCategory({ title: 'Study math', category: 'study_and_education', current: { label: 'Custom Sub', source: 'user', confidence: 0.9 } });
    assert.strictEqual(out.label, 'Custom Sub');
    assert.strictEqual(out.source, 'user');

    // 5) getSubcategoriesForCategory helper
    const studySubs = getSubcategoriesForCategory('study_and_education');
    assert.ok(Array.isArray(studySubs));
    assert.ok(studySubs.includes('AI & Machine Learning'));

    // 6) Fallback for uncategorized returns something useful
    out = await generateSubCategory({ title: 'Random task without hints', category: 'uncategorized' });
    assert.ok(out.label && typeof out.label === 'string');
    assert.ok(out.confidence >= 0 && out.confidence <= 1);

    // 7) getAllSubcategories returns mapping with expected keys
    const all = getAllSubcategories();
    assert.ok(all.study_and_education && Array.isArray(all.study_and_education));

    console.log('\n✅ subcategoryGenerator unit tests passed.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ subcategoryGenerator unit tests failed:\n', err);
    process.exit(1);
  }
})();
