// scripts/trainBaseline.js
// Train a simple logistic regression baseline on exported suggestion data.

import fs from "fs/promises";
import path from "path";

function encodeCategory(category) {
  // One-hot encode categories for the classifier
  const cats = ["work", "study", "health", "social", "finance", "household", "creative", "misc"];
  return cats.map((c) => (category === c ? 1 : 0));
}

function timeFeatures(timestamp) {
  // Normalize hour-of-day and flag coarse time buckets
  const date = new Date(timestamp);
  const hours = date.getUTCHours();
  const day = date.getUTCDay();
  return [
    hours / 23, // normalize hour
    hours >= 5 && hours < 12 ? 1 : 0,
    hours >= 12 && hours < 17 ? 1 : 0,
    hours >= 17 && hours < 22 ? 1 : 0,
    day === 0 || day === 6 ? 1 : 0,
  ];
}

function buildFeatureVector(row) {
  const category = row.suggestedCategory || "misc";
  const priorities = row.priorities || {};
  const recentCounts = row.recentCounts || {};

  const priority = Number(priorities[category] ?? 3);
  const count = Number(recentCounts[category] ?? 0);
  const ratio = priority / (count + 1);

  return [
    priority / 5, // normalize
    count,
    ratio / 5,
    ...timeFeatures(row.timestamp),
    ...encodeCategory(category),
  ];
}

function shuffleInPlace(array) {
  // Fisher–Yates shuffle to randomize dataset order
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function trainLogisticRegression(features, labels, { iterations = 2000, learningRate = 0.05 } = {}) {
  // Batch gradient descent for binary logistic regression
  const nSamples = features.length;
  const nFeatures = features[0].length;
  let weights = new Array(nFeatures).fill(0);
  let bias = 0;

  for (let iter = 0; iter < iterations; iter++) {
    let gradW = new Array(nFeatures).fill(0);
    let gradB = 0;

    for (let i = 0; i < nSamples; i++) {
      const x = features[i];
      const y = labels[i];
      const z = dot(weights, x) + bias;
      const pred = sigmoid(z);
      const error = pred - y;

      for (let k = 0; k < nFeatures; k++) {
        gradW[k] += error * x[k];
      }
      gradB += error;
    }

    for (let k = 0; k < nFeatures; k++) {
      weights[k] -= (learningRate / nSamples) * gradW[k];
    }
    bias -= (learningRate / nSamples) * gradB;

    if ((iter + 1) % 500 === 0) {
      const loss = computeLoss(features, labels, weights, bias);
      console.log(`iter ${iter + 1}: loss=${loss.toFixed(4)}`);
    }
  }

  return { weights, bias };
}

function computeLoss(features, labels, weights, bias) {
  let total = 0;
  for (let i = 0; i < features.length; i++) {
    const pred = sigmoid(dot(weights, features[i]) + bias);
    const y = labels[i];
    total += -y * Math.log(pred + 1e-8) - (1 - y) * Math.log(1 - pred + 1e-8);
  }
  return total / features.length;
}

function evaluate(features, labels, model) {
  // Compute simple accuracy on the provided split
  let correct = 0;
  for (let i = 0; i < features.length; i++) {
    const pred = sigmoid(dot(model.weights, features[i]) + model.bias);
    const predictedLabel = pred >= 0.5 ? 1 : 0;
    if (predictedLabel === labels[i]) correct++;
  }
  return correct / features.length;
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: node scripts/trainBaseline.js <training-export.json>");
    process.exit(1);
  }

  const resolved = path.resolve(fileArg);
  const raw = await fs.readFile(resolved, "utf8");
  // Training rows exported via scripts/exportTrainingData.js
  const rows = JSON.parse(raw);

  if (rows.length === 0) {
    console.error("Dataset is empty.");
    process.exit(1);
  }

  const dataset = rows.map((row) => ({
    x: buildFeatureVector(row),
    y: row.accepted ? 1 : 0,
    meta: {
      userId: row.userId,
      category: row.suggestedCategory || "misc",
    },
  }));

  shuffleInPlace(dataset);

  const splitIndex = Math.max(1, Math.floor(dataset.length * 0.8));
  const trainSet = dataset.slice(0, splitIndex);
  const testSet = dataset.slice(splitIndex);

  const trainX = trainSet.map((d) => d.x);
  const trainY = trainSet.map((d) => d.y);
  const testX = testSet.map((d) => d.x);
  const testY = testSet.map((d) => d.y);

  const model = trainLogisticRegression(trainX, trainY, {
    iterations: 2000,
    learningRate: 0.05,
  });

  const trainAcc = evaluate(trainX, trainY, model);
  const testAcc = testSet.length ? evaluate(testX, testY, model) : null;

  console.log("Training accuracy:", trainAcc.toFixed(3));
  if (testAcc !== null) {
    console.log("Test accuracy:", testAcc.toFixed(3), `(test set size ${testSet.length})`);
  } else {
    console.log("Test accuracy: n/a (not enough rows to hold out test set).");
  }

  // Print a few sample predictions
  const samples = dataset.slice(0, Math.min(3, dataset.length)).map((d) => {
    const score = sigmoid(dot(model.weights, d.x) + model.bias);
    return {
      userId: d.meta.userId,
      category: d.meta.category,
      label: d.y,
      prediction: Number(score.toFixed(3)),
    };
  });
  console.log("Sample predictions:", samples);

  const modelFile = path.resolve(
    `data/model_logreg_${Date.now()}.json`
  );
  await fs.writeFile(modelFile, JSON.stringify({ ...model, featureCount: model.weights.length }, null, 2));
  console.log(`Saved model weights to ${modelFile}`);
}

main().catch((err) => {
  console.error("Training failed:", err);
  process.exit(1);
});
