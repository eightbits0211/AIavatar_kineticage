# Requirements Document

## Introduction

The AI Companion Workout feature is a voice and text-based AI companion within the Kinetic Age mobile app that guides users through personalized strength training sessions. The companion announces exercises, motivates during sets, checks in between sets, adapts difficulty based on user feedback, and summarizes progress. It uses voice (Deepgram STT + ElevenLabs TTS) as the primary interaction mode with text chat as a full-capability fallback. The companion has a warm, caring personality and prioritizes user safety — stopping when pain is reported and deferring medical questions to the Kinetic Age clinical team. The app targets a broad audience with a focus on accessibility for older adults.

## Glossary

- **Companion**: The AI workout assistant powered by Claude API (claude-sonnet-4) that guides users through sessions via voice and text
- **Session**: A single workout instance containing one or more exercises, each with sets and reps
- **Check_In**: The between-set interaction where the Companion asks the user how many reps they completed and how the exercise felt
- **Daily_Check_In**: A brief non-workout interaction where the Companion asks about sleep, energy, and soreness to inform future sessions
- **Routine**: A weekly workout plan generated from the user's profile, containing scheduled sessions with assigned exercises
- **Exercise_Library**: The collection of exercises with text descriptions, images, muscle groups, equipment requirements, and contraindications
- **Session_Summary**: A spoken and stored recap of what was accomplished during a session, including adaptations made
- **User_Profile**: The stored user data including physical attributes, fitness goal, fitness level, conditions/injuries, equipment, and preferences
- **User_Persona**: The AI-assigned category (e.g., Beginner, Regular Gym-Goer, Home Workout User) that determines communication style, intensity, and approach
- **AI_Personalization_Engine**: The backend logic that analyzes user inputs to assign a persona, calculate metrics (BMI, calories, max heart rate), and continuously refine the experience
- **Adaptation**: A modification to reps, sets, or exercise selection made by the Companion based on check-in feedback
- **Voice_Pipeline**: The chain of Deepgram (STT) → Claude API → ElevenLabs (TTS streaming) that enables spoken conversation
- **Text_Chat**: The typed fallback interface providing the same companion intelligence without voice
- **Rest_Period**: The time between sets during which the Companion provides motivational dialogue
- **Backend**: The Node.js + Express server that relays API calls, stores data, and manages API keys
- **State_Machine**: The Zustand-managed session state: idle → session_starting → exercise_intro → set_active → set_complete → check_in → rest → session_summary → idle
- **XP**: Experience points awarded for completing sessions, check-ins, and streaks
- **Streak**: The count of consecutive days a user has completed at least one workout session
- **Dashboard**: The home screen showing today's workout, streak, XP/level, and quick actions

## Requirements

### Requirement 1: User Onboarding & Profile Setup

**User Story:** As a new user, I want to provide my physical attributes, fitness background, health conditions, goals, and preferences during onboarding, so that the AI can create a truly personalized experience.

#### Acceptance Criteria

1. WHEN a user opens the App for the first time after account creation, THE App SHALL present the onboarding flow before granting access to workout features
2. THE onboarding flow SHALL collect the following data in sequential steps: age, height, weight, fitness experience level, health conditions/injuries, fitness goals, workout preferences, and available equipment
3. WHEN the user enters age, height, and weight, THE Backend SHALL calculate and store: BMI, estimated calorie requirements, and estimated max heart rate (220 - age)
4. THE App SHALL allow the user to select one or more fitness goals from: Strength Training, Weight Loss, Muscle Gain, Mobility/Flexibility, Injury Recovery, and General Fitness
5. THE App SHALL allow the user to select workout preferences including: preferred training days per week (2-7), preferred session duration (15, 30, 45, or 60 minutes), and workout location (home, gym, office)
6. THE App SHALL allow the user to select available equipment from a checklist including: none/bodyweight only, dumbbells, resistance bands, barbell, kettlebell, pull-up bar, bench, and exercise mat
7. WHEN the user selects health conditions, THE App SHALL allow multiple selections from: neck pain, shoulder issues, upper back pain, lower back pain, hip issues, knee issues, ankle issues, wrist issues, heart condition, and high blood pressure
8. WHEN the user completes all onboarding steps, THE Backend SHALL store the complete User_Profile in MongoDB and trigger the AI Personalization Engine
9. IF the user exits onboarding before completion, THEN THE App SHALL save progress and resume from the last completed step on next app open
10. WHEN the user wishes to update their profile later, THE App SHALL allow modification of all onboarding fields from the profile settings screen without requiring full re-onboarding

### Requirement 2: AI Personalization Engine & User Persona

**User Story:** As a user, I want the AI to analyze my profile and assign me a personalized user persona, so that my entire experience is tailored to my specific situation and goals.

#### Acceptance Criteria

1. WHEN onboarding is completed, THE AI Personalization Engine SHALL analyze user inputs (BMI, calorie requirements, max heart rate, fitness level, goals, equipment, conditions) to assign a User_Persona
2. THE AI Personalization Engine SHALL classify users into one of the following personas: Beginner (low intensity, basic exercises, frequent encouragement), Regular Gym-Goer (moderate-high intensity, progressive overload, performance focus), Weight Loss Seeker (calorie focus, calorie deficit guidance, nutrition integration), Muscle Gain User (strength focus, progressive training, protein tracking), Home Workout User (bodyweight/minimal equipment, space-efficient routines, flexibility focus), Office Worker (desk exercises, posture correction, desk mobility), AI Companion Seeker (high voice interaction, motivational style, daily check-ins), Injury Recovery User (physical therapy focus, gentle progression, medical clearance check), or Inconsistent User (habit building focus, streaks & reminders, low friction entry)
3. THE Backend SHALL store the assigned User_Persona with a confidence score and make it available to the Companion's system prompt
4. THE Companion SHALL adapt its communication style, exercise selection, intensity, and motivational approach based on the assigned User_Persona
5. WHEN the user's behavior diverges from their assigned persona over 5 or more sessions (e.g., a Beginner consistently completing advanced exercises), THE Backend SHALL update the User_Persona confidence score and recommend a persona reassignment
6. WHEN a persona reassignment is triggered, THE Companion SHALL inform the user that their plan is being updated to match their progress and ask for confirmation before applying changes

### Requirement 3: Companion Preferences & Voice Settings

**User Story:** As a user, I want to choose my AI companion's voice, interaction level, and motivation style, so that the experience feels personalized and comfortable for me.

#### Acceptance Criteria

1. DURING onboarding (after persona assignment), THE App SHALL present the user with companion preference options: AI avatar/voice selection, voice interaction level, and motivation style
2. THE App SHALL offer at least 2 distinct ElevenLabs voice options for the Companion (e.g., warm male voice, warm female voice) and allow the user to preview each before selecting
3. THE App SHALL allow the user to set a voice interaction level: High (companion speaks for all guidance, check-ins, and motivation), Medium (companion speaks for exercise announcements and summaries, text for check-ins), or Low (companion speaks only for exercise announcements, everything else is text)
4. THE App SHALL allow the user to select a motivation style: Gentle & Supportive (calm encouragement, low pressure), Energetic & Enthusiastic (upbeat, celebratory), or Coach-like & Direct (concise, results-focused but still warm)
5. WHEN preferences are set, THE Backend SHALL store them in the User_Profile and THE Companion's system prompt SHALL be configured accordingly
6. THE App SHALL allow the user to change companion preferences at any time from the settings screen, with changes taking effect from the next interaction
7. WHEN the user reviews their personalized plan, THE App SHALL display the generated routine, companion preferences, and persona summary for approval before proceeding to the dashboard

### Requirement 4: Workout Session Core Loop

**User Story:** As a user, I want the AI companion to guide me through my workout step by step, so that I know exactly what to do at each moment without needing to read a screen.

#### Acceptance Criteria

1. WHEN a user starts a session, THE Companion SHALL announce the first exercise including the exercise name, number of sets, target reps, and a brief description of the movement sourced from the Exercise_Library
2. WHEN an exercise announcement is complete, THE Companion SHALL wait for the user to indicate readiness (via voice saying "ready", "go", "start" or tapping a ready button) before starting the set guidance
3. IF the user does not indicate readiness within 60 seconds of the exercise announcement, THEN THE Companion SHALL prompt the user once asking if they are ready to begin
4. WHILE a set is active, THE Companion SHALL provide the user with the current set number out of total sets and the target rep count
5. WHEN the user indicates a set is done (via voice saying "done", "finished", or tapping a done button), THE Companion SHALL transition to the check-in state and ask how many reps they completed
6. WHEN all sets for an exercise are completed, THE Companion SHALL announce the next exercise in the session routine with a transition message
7. WHEN all exercises in the session are completed, THE Companion SHALL transition to the session summary state
8. THE State_Machine SHALL follow the defined state sequence: idle → session_starting → exercise_intro → set_active → set_complete → check_in → rest → next exercise or session_summary → idle
9. WHILE in the rest state between sets, THE Companion SHALL announce the rest duration and provide motivational dialogue until the rest period ends
10. IF the user requests to skip an exercise (via voice or text), THEN THE Companion SHALL acknowledge the skip, ask for a reason, record the reason if provided, and proceed to the next exercise
11. IF the user requests to end the session early, THEN THE Companion SHALL acknowledge the request, provide a partial session summary, and transition to idle

### Requirement 5: Voice Input

**User Story:** As a user, I want to speak to the companion naturally, so that I can interact hands-free while exercising.

#### Acceptance Criteria

1. WHEN the user taps the microphone button or the system detects the end of a rest period prompt, THE Voice_Pipeline SHALL begin capturing audio and send it to Deepgram for speech-to-text transcription within 500 milliseconds of activation
2. WHEN Deepgram returns a transcription, THE Backend SHALL forward the transcribed text to the Claude API as the user's message within 1 second of receiving the transcription
3. IF Deepgram fails to return a transcription within 5 seconds, THEN THE Backend SHALL retry the request once using the p-retry layer with a 2-second delay before the retry attempt
4. IF voice transcription fails after retry, THEN THE Companion SHALL display a visible notification prompting the user to try speaking again or switch to text input, and SHALL preserve any ongoing session state without interruption
5. WHEN a transcription is received, THE Companion SHALL display the transcribed text on screen for a minimum of 3 seconds or until the next user interaction, so the user can verify what was heard
6. THE Voice_Pipeline SHALL recognize utterances as short as a single word including phrases such as "done", "yes", "that was hard", and "stop"
7. WHILE the Voice_Pipeline is capturing audio, THE Voice_Pipeline SHALL enforce a maximum recording duration of 30 seconds per utterance, after which it SHALL automatically stop recording and send the captured audio for transcription
8. IF the Voice_Pipeline receives audio input where Deepgram returns an empty transcription result, THEN THE Companion SHALL not send an empty message to the Claude API and SHALL indicate to the user that no speech was detected

### Requirement 6: Voice Output

**User Story:** As a user, I want the companion to speak to me aloud, so that I can follow along without looking at the screen.

#### Acceptance Criteria

1. WHEN the Claude API returns a response, THE Backend SHALL stream the text to ElevenLabs for text-to-speech conversion
2. THE Voice_Pipeline SHALL use ElevenLabs streaming so that the first audio chunk begins playback within 2 seconds of the Claude API response being received
3. THE Companion SHALL use a single consistent ElevenLabs voice ID across all sessions for all users
4. IF ElevenLabs fails to return audio within 5 seconds, THEN THE Backend SHALL retry the request once using the p-retry layer with a 2-second delay
5. IF voice output fails after retry, THEN THE Companion SHALL display the response as text on screen, play no audio, and show a notification that voice is temporarily unavailable
6. WHILE voice output is playing, THE Companion SHALL display the corresponding text on screen simultaneously
7. IF the user initiates a new voice input while the Companion is still speaking, THEN THE Voice_Pipeline SHALL interrupt the current audio playback and begin processing the new user input

### Requirement 7: Between-Set Check-Ins

**User Story:** As a user, I want the companion to ask me how each set went, so that the workout adapts to how I'm actually feeling.

#### Acceptance Criteria

1. WHEN a set is completed, THE Companion SHALL ask the user how many reps they completed
2. WHEN the user reports rep count, THE Companion SHALL ask how the set felt using the options: easy, moderate, or tough
3. WHEN the user reports that the set felt easy and they completed all target reps, THE Companion SHALL increase the target reps for the next set by 2 reps
4. WHEN the user reports that the set felt moderate, THE Companion SHALL maintain the current target reps for the next set unchanged
5. WHEN the user reports that the set felt tough, THE Companion SHALL reduce the target reps for the next set by 2 reps with a minimum floor of 3 reps
6. WHEN the user completes fewer reps than targeted, THE Companion SHALL acknowledge the effort without shame, set the next set's target to the number of reps the user actually completed, and encourage continued effort
7. IF the adaptation applies to the last set of an exercise, THEN THE Companion SHALL record the adaptation and apply it to the first set of the same exercise in the next session
8. THE Companion SHALL store all check-in responses for the session including rep counts, difficulty ratings, and adaptations made in the session_turns collection
9. IF the user reports pain during a check-in, THEN THE Companion SHALL immediately stop the exercise, suggest rest, and ask if the user wants to skip to the next exercise or end the session

### Requirement 8: Motivational Dialogue

**User Story:** As a user, I want the companion to encourage me between sets in a warm and caring way, so that I feel supported and motivated to continue.

#### Acceptance Criteria

1. WHILE in the rest state between sets, THE Companion SHALL provide at least one motivational message to the user before the next set begins
2. THE Companion SHALL use a warm, caring, and supportive tone in all motivational messages
3. THE Companion SHALL not repeat the same motivational message within a single session
4. WHEN the user completes fewer reps than targeted, THE Companion SHALL respond with encouragement acknowledging the effort made rather than expressing disappointment about the shortfall
5. THE Companion SHALL NOT use aggressive, high-pressure, or shame-based language in any interaction
6. WHEN the user completes a set where the reported difficulty is "tough" and they completed at least 80% of target reps, THE Companion SHALL acknowledge the accomplishment specifically referencing the exercise name and reps achieved
7. IF previous Session_Summaries exist for the user, THEN THE Companion SHALL reference the user's progress from previous sessions when providing encouragement during rest periods
8. IF no previous Session_Summaries exist for the user, THEN THE Companion SHALL provide encouragement based solely on the user's effort within the current session

### Requirement 9: Personalized Routine Generation

**User Story:** As a user, I want a weekly workout plan tailored to my fitness level, goals, and any physical limitations, so that I get an appropriate and safe program.

#### Acceptance Criteria

1. WHEN a user completes their profile with fitness goal, fitness level, conditions or injuries, available equipment, and preferred training days, THE Companion SHALL generate a personalized weekly Routine
2. THE Routine SHALL assign exercises from the Exercise_Library whose difficulty level matches the user's stated fitness level (beginner, intermediate, or advanced)
3. THE Routine SHALL exclude exercises that are contraindicated for the user's reported conditions or injuries as defined in the Exercise_Library
4. THE Routine SHALL only include exercises that can be performed with the user's selected available equipment
5. THE Routine SHALL distribute exercises across the user's preferred training days such that the same muscle group is not targeted on consecutive calendar days
6. WHEN a new Routine is generated, THE Backend SHALL store the Routine in MongoDB associated with the user's profile
7. WHEN a user starts a session and the current day matches a preferred training day in the active Routine, THE Companion SHALL select the workout assigned to that day
8. IF the user starts a session on a day not included in the active Routine's preferred training days, THEN THE Companion SHALL inform the user that no workout is scheduled for today and offer to start the next scheduled workout or a quick bonus session
9. IF the user requests a routine change, THEN THE Companion SHALL regenerate the Routine incorporating the user's feedback
10. WHEN generating an updated Routine, THE Companion SHALL reference previous Session_Summaries including completed rep counts, difficulty feedback, and adaptations to adjust exercise intensity for the user's progression
11. THE Routine SHALL assign between 3 and 6 exercises per scheduled training day, with session duration aligned to the user's preferred session duration from their profile
12. THE Routine SHALL match exercises to the user's fitness goals (e.g., calorie-burning circuits for Weight Loss, compound lifts for Muscle Gain, gentle mobility for Injury Recovery)

### Requirement 10: Session Summary & Recovery Recommendations

**User Story:** As a user, I want a summary of what I accomplished after each workout and recovery guidance, so that I can track my progress and recover properly.

#### Acceptance Criteria

1. WHEN a session is completed, THE Companion SHALL generate a spoken summary within 10 seconds including total exercises completed, total sets, total reps, and adaptations made during the session
2. WHEN a session summary is generated, THE Backend SHALL store the Session_Summary in MongoDB associated with the user and session
3. THE Session_Summary SHALL include which exercises were completed, which were skipped with their skip reasons, and any pain events reported including the exercise that triggered each pain event
4. THE Companion SHALL deliver the session summary via voice output using the same warm tone as the rest of the session
5. WHEN the user starts a future session, THE Companion SHALL reference the most recent 3 Session_Summaries to provide continuity on progress and any recurring adaptations
6. IF a session is ended early, THEN THE Companion SHALL generate a partial summary covering only the completed portion of the session including the number of exercises completed out of the total planned
7. IF the Backend fails to store the Session_Summary after retry, THEN THE Companion SHALL notify the user that the summary could not be saved and display the summary on screen for manual reference
8. AFTER the session summary is delivered, THE Companion SHALL provide a recovery recommendation including suggested rest duration before next workout, hydration reminder, and any stretch suggestions relevant to the muscles worked
9. THE Backend SHALL collect post-workout feedback: perceived overall difficulty (1-5 scale) and energy level (low, medium, high) to inform future session planning

### Requirement 11: Text Chat Fallback

**User Story:** As a user, I want to type messages to the companion when I can't or don't want to use voice, so that I can still get the full workout experience.

#### Acceptance Criteria

1. THE Text_Chat SHALL use the same Claude API system prompt, session context, and adaptive logic as the voice interface so that workout guidance, check-ins, and motivational behavior are identical regardless of input mode
2. WHEN a user sends a text message, THE Backend SHALL forward the message to the Claude API and return the response as text within 10 seconds
3. THE Text_Chat SHALL display the conversation history within the current session showing the most recent 50 messages with the ability to scroll to earlier messages
4. WHEN a user switches from voice to text mid-session, THE Companion SHALL continue the session without interruption or loss of context by maintaining the same conversation history and State_Machine position
5. WHEN a user switches from text to voice mid-session, THE Companion SHALL continue the session without interruption or loss of context by maintaining the same conversation history and State_Machine position
6. THE Text_Chat SHALL display companion messages with a visually distinct background color or alignment from user messages, using a minimum font size of 16sp for readability
7. IF the Claude API fails to return a response within 10 seconds during text chat, THEN THE Backend SHALL retry the request once and if the retry fails, display an error message indicating the companion is temporarily unavailable

### Requirement 12: Exercise Library

**User Story:** As a user, I want to see descriptions and images of exercises, so that I understand proper form even without video.

#### Acceptance Criteria

1. THE Exercise_Library SHALL contain a text description and at least one image for each exercise
2. THE Exercise_Library SHALL include for each exercise: name, description, target muscles, step-by-step instructions with numbered steps, difficulty level (beginner, intermediate, or advanced), required equipment, and contraindications
3. WHEN the Companion announces an exercise, THE Companion SHALL reference the Exercise_Library entry to provide the user with the exercise name, target muscles, and step-by-step instructions
4. WHEN a user requests more detail about an exercise, THE Companion SHALL provide the full Exercise_Library description verbally and THE App SHALL display the associated image on screen
5. THE Exercise_Library SHALL be stored in MongoDB and accessible via the Backend API
6. THE Companion SHALL use exercise contraindications from the Exercise_Library when generating Routines for users with reported conditions to exclude contraindicated exercises
7. IF an exercise image fails to load, THEN THE App SHALL display a placeholder indicating the image is unavailable and the Companion SHALL provide additional verbal description of the starting position

### Requirement 13: Safety and Pain Handling

**User Story:** As a user, I want the companion to stop immediately if I report pain and never push me to continue through discomfort, so that I feel safe during workouts.

#### Acceptance Criteria

1. WHEN the user reports pain during any interaction, THE Companion SHALL stop the current exercise guidance within the next conversational turn and acknowledge the reported pain
2. WHEN pain is reported, THE Companion SHALL suggest rest and ask the user if they want to skip to the next exercise or end the session
3. THE Companion SHALL NOT encourage the user to push through reported pain under any circumstance including phrases that minimize pain or suggest continuing the current exercise
4. THE Companion SHALL record pain events in the session data including which exercise triggered the pain, which body area was affected, and the timestamp of the report
5. WHEN generating future Routines, THE Companion SHALL reference recorded pain events to exclude or substitute exercises that previously caused pain for the affected body area
6. IF a user asks a medical question, THEN THE Companion SHALL decline to answer the medical question, state that it cannot provide medical advice, and direct the user to contact the Kinetic Age clinical team via the contact information available in the app
7. THE Companion SHALL NOT provide medical diagnoses, treatment recommendations, or physiotherapy advice

### Requirement 14: Companion Personality and Identity

**User Story:** As a user, I want the companion to have a consistent name and personality, so that interactions feel personal and trustworthy.

#### Acceptance Criteria

1. THE Companion SHALL have a defined name used consistently across all interactions including session greetings, mid-session dialogue, and session summaries
2. THE Companion SHALL maintain a consistent personality defined via the Claude API system prompt that persists across all sessions for a given user
3. THE Companion SHALL use a warm, patient, and encouraging communication style with short sentences and simple vocabulary accessible to users of all ages including older adults
4. THE Companion SHALL NOT use fitness jargon, slang, or technical terminology without immediately following it with a plain-language explanation
5. WHEN addressing the user, THE Companion SHALL use the user's preferred name as stored in the User_Profile
6. THE Companion SHALL maintain conversational continuity within a session by referencing user statements and responses from earlier in the same session when contextually relevant

### Requirement 15: Gamification — Streaks

**User Story:** As a user, I want to maintain workout streaks, so that I feel motivated to stay consistent with my training.

#### Acceptance Criteria

1. WHEN a user completes at least one workout session in a calendar day, THE Backend SHALL mark that day as an active streak day
2. THE Backend SHALL maintain a current_streak counter representing the number of consecutive days the user has completed at least one session
3. WHEN a user completes a session and the previous day was also an active streak day, THE Backend SHALL increment the current_streak counter by 1
4. IF a user does not complete any session for an entire calendar day, THEN THE Backend SHALL reset the current_streak counter to 0 at the start of the following day
5. THE Backend SHALL store the user's longest_streak (all-time best) and update it whenever current_streak exceeds it
6. WHEN the user opens the app, THE Companion SHALL acknowledge the user's current streak in the greeting (e.g., "You're on a 5-day streak!")
7. WHEN a user's streak reaches milestones of 7, 14, 30, 60, and 100 days, THE Companion SHALL deliver a special congratulatory message and THE Backend SHALL award bonus XP
8. IF a user's streak is at risk (they haven't worked out today and it's past 6 PM in their local timezone), THEN THE App SHALL send a push notification reminding them to maintain their streak

### Requirement 16: Gamification — XP System

**User Story:** As a user, I want to earn experience points for my workout activity, so that I can see my overall engagement grow over time.

#### Acceptance Criteria

1. WHEN a user completes a workout session, THE Backend SHALL award XP based on the session: 50 XP base + 10 XP per exercise completed + 5 XP per set completed
2. WHEN a user completes all exercises in a session without skipping any, THE Backend SHALL award a 25 XP completion bonus
3. WHEN a user maintains a streak milestone (7, 14, 30, 60, 100 days), THE Backend SHALL award bonus XP: 100 XP for 7-day, 250 XP for 14-day, 500 XP for 30-day, 1000 XP for 60-day, 2500 XP for 100-day
4. WHEN a user completes a daily check-in, THE Backend SHALL award 10 XP
5. THE Backend SHALL store total_xp for each user and make it available to the App for display
6. THE App SHALL display the user's total XP and current level on the profile/dashboard screen
7. THE Backend SHALL calculate user level from total XP using the formula: Level = floor(total_xp / 500) + 1
8. WHEN a user levels up, THE Companion SHALL announce the level-up during the next interaction and congratulate the user

### Requirement 17: Gamification — Progress Tracking & Charts

**User Story:** As a user, I want to see charts and metrics showing my improvement over time, so that I can visualize my progress and stay motivated.

#### Acceptance Criteria

1. THE App SHALL display a weekly progress chart showing the number of sessions completed per day for the current and previous week
2. THE App SHALL display a monthly view showing total sessions, total exercises, total sets, and total reps completed in the current month compared to the previous month
3. THE App SHALL display a streak history chart showing the user's streak length over the past 90 days
4. THE App SHALL display per-exercise progress showing how the user's rep count has changed over time for each exercise they've performed more than 3 times
5. WHEN the user navigates to the progress screen, THE Backend SHALL retrieve aggregated session data from MongoDB and return it in a format ready for chart rendering
6. THE App SHALL display the user's XP progression and level history as a visual indicator on the progress screen
7. THE App SHALL show a "personal bests" section listing the user's highest single-session rep count, longest streak, highest XP earned in one session, and most sessions in a week
8. WHEN the user's progress shows measurable improvement (e.g., rep count increased for an exercise over 3 consecutive sessions), THE Companion SHALL acknowledge this improvement during the next workout session

### Requirement 18: Authentication and Data Persistence

**User Story:** As a user, I want my profile, routines, session history, and gamification data saved securely, so that my progress is preserved across app launches.

#### Acceptance Criteria

1. THE Backend SHALL authenticate users via Firebase Auth before granting access to any API endpoint
2. WHEN a user signs in, THE Backend SHALL retrieve the associated User_Profile, active Routine, the 5 most recent Session_Summaries, and gamification data (XP, streak, achievements) from MongoDB
3. THE Backend SHALL store all session data including conversation turns, check-in responses, adaptations, and XP awarded in MongoDB
4. THE Backend SHALL associate all stored data with the authenticated user's identifier to ensure no cross-user data access
5. IF an API call to Claude, Deepgram, or ElevenLabs fails, THEN THE Backend SHALL retry the request up to 3 times using p-retry with exponential backoff starting at 1 second before returning an error to the client
6. THE Backend SHALL keep all third-party API keys server-side and never expose them to the mobile client
7. IF all retries for an external API call are exhausted, THEN THE Backend SHALL return an error response to the client indicating which service is unavailable so the App can display an appropriate fallback message to the user

### Requirement 19: Daily Check-Ins

**User Story:** As a user, I want the companion to check in with me daily even on non-workout days, so that I stay engaged and the AI can track my recovery and energy levels.

#### Acceptance Criteria

1. WHEN the user opens the App on a non-workout day, THE Companion SHALL initiate a brief daily check-in asking how the user is feeling and their energy level
2. THE daily check-in SHALL collect: sleep quality (poor, okay, good, great), energy level (low, medium, high), and any soreness or pain from the previous workout
3. WHEN the user reports soreness, THE Companion SHALL record which body areas are affected and factor this into the next workout session's exercise selection
4. WHEN the user reports low energy or poor sleep, THE Companion SHALL suggest a lighter session for the next workout day and adjust the Routine intensity accordingly
5. THE Backend SHALL store daily check-in data in MongoDB and make it available to the AI Personalization Engine for ongoing persona refinement
6. THE Companion SHALL award 10 XP for completing a daily check-in
7. THE daily check-in interaction SHALL take no longer than 30 seconds via voice or 3 taps via text to complete
8. IF the user does not open the app by their configured check-in time, THEN THE App SHALL send a push notification with a brief check-in prompt

### Requirement 20: Dashboard & User Actions

**User Story:** As a user, I want a home dashboard that gives me quick access to start a workout, check my progress, and see my daily status at a glance.

#### Acceptance Criteria

1. WHEN the user opens the App and is authenticated, THE App SHALL display the Dashboard screen as the default home view
2. THE Dashboard SHALL display: today's scheduled workout (or next scheduled workout if today is a rest day), current streak count, current XP/level, and a greeting from the Companion
3. THE Dashboard SHALL provide quick-action buttons for: Start Workout, Check Progress, and Daily Check-In
4. WHEN the user taps Start Workout, THE App SHALL load the appropriate session from the active Routine and transition to the workout session screen
5. WHEN the user taps Check Progress, THE App SHALL navigate to the progress tracking screen showing charts and personal bests
6. WHEN the user taps Daily Check-In, THE App SHALL initiate the daily check-in flow with the Companion
7. THE Dashboard SHALL display the user's assigned User_Persona as a subtle label (e.g., "Home Workout Pro" or "Getting Stronger Every Day") to reinforce identity
8. IF the user has an unfinished workout from a previous session that was interrupted, THEN THE Dashboard SHALL offer to resume that session

### Requirement 21: Continuous Learning & Plan Optimization

**User Story:** As a user, I want the AI to continuously learn from my behavior and optimize my plan over time, so that my workouts keep getting better suited to me.

#### Acceptance Criteria

1. AFTER every 5 completed sessions, THE AI Personalization Engine SHALL analyze cumulative session data (completion rates, difficulty feedback, pain events, daily check-in data, adaptations) and update the User_Persona confidence score
2. WHEN the User_Persona confidence score drops below 60% (indicating the user's behavior no longer matches the assigned persona), THE Backend SHALL trigger a persona reassignment evaluation
3. THE Backend SHALL track patterns including: exercises consistently skipped, exercises where the user always reports "easy", time-of-day preferences, and average session completion rate
4. WHEN the Companion regenerates a Routine, THE AI SHALL incorporate learned patterns to optimize exercise selection, intensity, and scheduling
5. THE Backend SHALL update the user's calorie requirements and recommended intensity if the user updates their weight in the profile
6. WHEN the AI detects the user is consistently completing all reps and reporting sets as "easy" for 3+ sessions, THE Companion SHALL suggest increasing overall workout difficulty and await user confirmation before applying
