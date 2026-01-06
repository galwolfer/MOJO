from single_feature_linucb_model import SingleFeatureLinUCB


#python test_linucb.py


# Initialize the LinUCB model
model = SingleFeatureLinUCB(alpha=0.1)

# Feature representing motivation level (1..5)
x = 5

# first prediction
pred_before = model.predict_category(x)
score_before = model.predict_score(x)

print("prediction before update:", pred_before)
print("score before update:", score_before)

# presume the user performed very late → reward = 0
reward = 0.2
model.update(x, reward)

# prediction after model update
pred_after = model.predict_category(x)
score_after = model.predict_score(x)

print("\nprediction after update:", pred_after)
print("score after update:", score_after)
print("new theta:", model.theta)



#presume the user performed very quickly → reward = 1
reward = 1
model.update(x, reward)

model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)
model.update(x, reward)



# prediction after model update
pred_after2 = model.predict_category(x)
score_after2 = model.predict_score(x)

print("\nprediction2 after update:", pred_after2)
print("score2 after update:", score_after2)
print("new theta2:", model.theta)