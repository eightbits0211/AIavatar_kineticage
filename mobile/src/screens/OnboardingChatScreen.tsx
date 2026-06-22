import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
} from 'react-native';

import { colors, spacing, typography, borderRadius } from '../theme';
import { useOnboardingStore } from '../stores/onboardingStore';
import { useUserStore } from '../stores/userStore';
import { apiPost } from '../services/api';
import { signOutCurrentUser } from '../services/auth';
import KinAvatar from '../components/KinAvatar';
import ChatMessage from '../components/ChatMessage';
import HorizontalButtons from '../components/HorizontalButtons';
import type { PersonalizeResponse } from '../../../shared/types';

export default function OnboardingChatScreen() {
  const {
    currentStep,
    messages,
    data,
    isProcessing,
    addMessage,
    updateData,
    nextStep,
    setProcessing,
  } = useOnboardingStore();

  const setOnboarded = useUserStore((s) => s.setOnboarded);
  const setUser = useUserStore((s) => s.setUser);
  
  const [inputValue, setInputValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const scrollViewRef = useRef<FlatList>(null);

  // Calculate progress percentage based on current step
  const getProgressPercentage = () => {
    const steps = ['welcome', 'name', 'age', 'height', 'weight', 'fitness_level', 'goals', 'activity_level', 'location', 'equipment', 'injuries', 'duration', 'experience', 'preferences', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    return Math.max(0, Math.min(100, Math.round((currentIndex / (steps.length - 1)) * 100)));
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      addMessage('kin', "Hi! I'm Kin, your AI fitness coach. I'm going to build a workout plan made just for you — it only takes a minute.");
      setTimeout(() => {
        addMessage('kin', "First things first — what's your name? I like to keep things personal.");
        nextStep();
      }, 1500);
    }
  }, []);

  // Handle step progression and AI responses
  useEffect(() => {
    if (currentStep === 'complete') {
      handlePersonalization();
    }
  }, [currentStep]);

  const handlePersonalization = async () => {
    setProcessing(true);
    try {
      const response = await apiPost<PersonalizeResponse>('/api/personalize', {
        name: data.name,
        age: data.age,
        height_cm: data.height_cm,
        weight_kg: data.weight_kg,
        fitness_goal: data.fitness_goal,
        activity_level: data.activity_level,
        workout_location: data.workout_location,
        equipment: data.equipment,
        injuries: data.injuries,
        injury_notes: data.injury_notes,
        workout_duration: data.workout_duration,
        prior_program_experience: data.prior_program_experience,
        companion_preferences: {
          talkativeness: data.talkativeness || 'balanced',
          voice_id: 'default',
          in_session_verbosity: 'standard',
        },
      });

      addMessage('kin', "Perfect! I've created your personalized workout plan. Let's get started on your fitness journey!");
      
      setTimeout(() => {
        setOnboarded(true);
      }, 2000);
    } catch (error) {
      addMessage('kin', "Oops! Something went wrong. Let me try setting up your plan again...");
      setTimeout(() => handlePersonalization(), 2000);
    } finally {
      setProcessing(false);
    }
  };

  const getStepContent = () => {
    switch (currentStep) {
      case 'age':
        return {
          inputPlaceholder: 'Your age',
          inputType: 'numeric' as const,
          validate: (value: string) => {
            const age = parseInt(value);
            return age >= 16 && age <= 100;
          },
          onSubmit: (value: string) => {
            const age = parseInt(value);
            updateData('age', age);
            addMessage('user', value);
            addMessage('kin', `Got it! What's your height? I can work with feet/inches or centimeters.`);
            nextStep();
          },
        };

      case 'height':
        return {
          inputPlaceholder: 'Height (e.g., 5\'8" or 173 cm)',
          onSubmit: (value: string) => {
            // Simple height parsing - could be improved
            let heightCm = 0;
            if (value.includes('\'') || value.includes('"')) {
              // Feet and inches
              const feet = parseInt(value.match(/(\d+)'/)?.[1] || '0');
              const inches = parseInt(value.match(/(\d+)"/)?.[1] || '0');
              heightCm = feet * 30.48 + inches * 2.54;
            } else {
              // Centimeters
              heightCm = parseInt(value.replace(/\D/g, ''));
            }
            updateData('height_cm', Math.round(heightCm));
            addMessage('user', value);
            addMessage('kin', `Perfect! And your current weight?`);
            nextStep();
          },
        };

      case 'weight':
        return {
          inputPlaceholder: 'Weight (e.g., 150 lbs or 70 kg)',
          onSubmit: (value: string) => {
            // Simple weight parsing
            let weightKg = 0;
            if (value.toLowerCase().includes('lb')) {
              weightKg = parseInt(value.replace(/\D/g, '')) * 0.453592;
            } else {
              weightKg = parseInt(value.replace(/\D/g, ''));
            }
            updateData('weight_kg', Math.round(weightKg));
            addMessage('user', value);
            addMessage('kin', `How would you describe your current fitness level?`);
            nextStep();
          },
        };

      case 'fitness_level':
        return {
          buttons: [
            { label: 'Beginner', value: 'beginner' },
            { label: 'Intermediate', value: 'intermediate' },
            { label: 'Advanced', value: 'advanced' },
          ],
          onButtonPress: (value: string) => {
            updateData('fitness_level', value);
            addMessage('user', value.charAt(0).toUpperCase() + value.slice(1));
            addMessage('kin', `What's your main fitness goal? I want to make sure we're working toward what matters to you.`);
            nextStep();
          },
        };

      case 'goals':
        return {
          buttons: [
            { label: 'Strength', value: 'strength' },
            { label: 'Muscle Building', value: 'hypertrophy' },
            { label: 'Weight Loss', value: 'weight_loss' },
            { label: 'General Fitness', value: 'general_fitness' },
            { label: 'Mobility', value: 'mobility' },
            { label: 'Home Workouts', value: 'home_workout' },
          ],
          onButtonPress: (value: string) => {
            updateData('fitness_goal', value);
            const label = value.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            addMessage('user', label);
            addMessage('kin', `How active are you in your daily life?`);
            nextStep();
          },
        };

      case 'activity_level':
        return {
          buttons: [
            { label: 'Sedentary', value: 'sedentary' },
            { label: 'Lightly Active', value: 'lightly_active' },
            { label: 'Moderately Active', value: 'moderately_active' },
            { label: 'Very Active', value: 'very_active' },
          ],
          onButtonPress: (value: string) => {
            updateData('activity_level', value);
            const label = value.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            addMessage('user', label);
            addMessage('kin', `Where do you prefer to work out?`);
            nextStep();
          },
        };

      case 'location':
        return {
          buttons: [
            { label: 'Home', value: 'home' },
            { label: 'Gym', value: 'gym' },
            { label: 'Outdoors', value: 'outdoors' },
            { label: 'Mix of All', value: 'hybrid' },
          ],
          onButtonPress: (value: string) => {
            updateData('workout_location', value);
            const label = value === 'hybrid' ? 'Mix of All' : value.charAt(0).toUpperCase() + value.slice(1);
            addMessage('user', label);
            addMessage('kin', `What equipment do you have access to? Select all that apply.`);
            nextStep();
          },
        };

      case 'equipment':
        return {
          multiSelect: true,
          buttons: [
            { label: 'None', value: 'none' },
            { label: 'Dumbbells', value: 'dumbbells' },
            { label: 'Barbell', value: 'barbell' },
            { label: 'Resistance Bands', value: 'resistance_bands' },
            { label: 'Kettlebell', value: 'kettlebell' },
            { label: 'Pull-up Bar', value: 'pull_up_bar' },
            { label: 'Bench', value: 'bench' },
            { label: 'Gym Machines', value: 'machines' },
          ],
          onContinue: () => {
            updateData('equipment', selectedOptions);
            const labels = selectedOptions.map(opt => 
              opt.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
            ).join(', ');
            addMessage('user', labels || 'None selected');
            addMessage('kin', `Any injuries or areas I should avoid in your workouts?`);
            setSelectedOptions([]);
            nextStep();
          },
        };

      case 'injuries':
        return {
          multiSelect: true,
          buttons: [
            { label: 'None', value: 'none' },
            { label: 'Knee', value: 'knee' },
            { label: 'Lower Back', value: 'lower_back' },
            { label: 'Shoulder', value: 'shoulder' },
            { label: 'Wrist', value: 'wrist' },
            { label: 'Ankle', value: 'ankle' },
            { label: 'Other', value: 'other' },
          ],
          onContinue: () => {
            updateData('injuries', selectedOptions);
            const labels = selectedOptions.map(opt => 
              opt.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
            ).join(', ');
            addMessage('user', labels || 'None');
            addMessage('kin', `How long would you like your workouts to be?`);
            setSelectedOptions([]);
            nextStep();
          },
        };

      case 'duration':
        return {
          buttons: [
            { label: '15 minutes', value: '15' },
            { label: '30 minutes', value: '30' },
            { label: '45 minutes', value: '45' },
            { label: '60 minutes', value: '60' },
          ],
          onButtonPress: (value: string) => {
            updateData('workout_duration', parseInt(value));
            addMessage('user', `${value} minutes`);
            addMessage('kin', `Have you followed a structured workout program before?`);
            nextStep();
          },
        };

      case 'experience':
        return {
          buttons: [
            { label: 'Yes', value: 'true' },
            { label: 'No', value: 'false' },
          ],
          onButtonPress: (value: string) => {
            updateData('prior_program_experience', value === 'true');
            addMessage('user', value === 'true' ? 'Yes' : 'No');
            addMessage('kin', `Last thing — how chatty would you like me to be during workouts?`);
            nextStep();
          },
        };

      case 'preferences':
        return {
          buttons: [
            { label: 'Minimal', value: 'minimal' },
            { label: 'Balanced', value: 'balanced' },
            { label: 'High', value: 'high' },
          ],
          onButtonPress: (value: string) => {
            updateData('talkativeness', value);
            addMessage('user', value.charAt(0).toUpperCase() + value.slice(1));
            addMessage('kin', `Perfect! Let me create your personalized plan...`);
            nextStep();
          },
        };

      default:
        return { inputPlaceholder: 'Type your response...' };
    }
  };

  const stepContent = getStepContent();

  const handleSubmit = () => {
    if (!inputValue.trim() || isProcessing) return;

    if (currentStep === 'name') {
      updateData('name', inputValue.trim());
      addMessage('user', inputValue.trim());
      addMessage('kin', `Nice to meet you ${inputValue.trim()}! How old are you? This helps me keep your workouts safe.`);
      nextStep();
    } else if (stepContent.onSubmit) {
      if (!stepContent.validate || stepContent.validate(inputValue)) {
        stepContent.onSubmit(inputValue);
      } else {
        // Basic validation feedback
        addMessage('kin', 'Please enter a valid value.');
        return;
      }
    }

    setInputValue('');
  };

  const handleButtonPress = (value: string) => {
    if (stepContent.multiSelect) {
      setSelectedOptions(prev => 
        prev.includes(value) 
          ? prev.filter(opt => opt !== value)
          : [...prev, value]
      );
    } else if (stepContent.onButtonPress) {
      stepContent.onButtonPress(value);
    }
  };

  const handleMultiSelectContinue = () => {
    if (stepContent.onContinue) {
      stepContent.onContinue();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <KinAvatar size={48} />
          <View style={styles.headerText}>
            <Text style={styles.headerName}>Kin</Text>
            <Text style={styles.headerTitle}>AI Fitness Coach</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>{getProgressPercentage()}% complete</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${getProgressPercentage()}%` }]} />
              </View>
            </View>
            <Pressable 
              style={styles.logoutButton}
              onPress={() => signOutCurrentUser()}
            >
              <Text style={styles.logoutText}>×</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={scrollViewRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatMessage role={item.role} content={item.content} />
        )}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Quick Buttons */}
      {stepContent.buttons && (
        <View style={styles.buttonsContainer}>
          <HorizontalButtons
            buttons={stepContent.buttons}
            onPress={handleButtonPress}
            selectedValues={selectedOptions}
            multiSelect={stepContent.multiSelect}
          />
          {stepContent.multiSelect && (
            <View style={styles.continueButtonContainer}>
              <Pressable
                style={styles.continueButton}
                onPress={handleMultiSelectContinue}
              >
                <Text style={styles.continueText}>Continue</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Input */}
      {!stepContent.buttons && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={stepContent.inputPlaceholder}
            placeholderTextColor={colors.textLight}
            keyboardType={stepContent.inputType || 'default'}
            onSubmitEditing={handleSubmit}
            editable={!isProcessing}
          />
          <Pressable
            style={[styles.sendButton, (!inputValue.trim() || isProcessing) && styles.sendButtonDisabled]}
            onPress={handleSubmit}
            disabled={!inputValue.trim() || isProcessing}
          >
            <Text style={styles.sendButtonText}>→</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xxl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  headerName: {
    ...typography.h2,
    color: colors.surface,
  },
  headerTitle: {
    ...typography.caption,
    color: colors.surface,
    opacity: 0.9,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  progressContainer: {
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  progressText: {
    ...typography.small,
    color: colors.surface,
    opacity: 0.9,
    marginBottom: 4,
  },
  progressBar: {
    width: 60,
    height: 4,
    backgroundColor: colors.progressBar,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.surface,
    borderRadius: 2,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  logoutText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: 'bold',
  },
  messagesContainer: {
    paddingVertical: spacing.md,
  },
  buttonsContainer: {
    backgroundColor: colors.background,
    paddingBottom: spacing.md,
  },
  continueButtonContainer: {
    paddingHorizontal: spacing.md,
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  continueText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 25,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textInput: {
    flex: 1,
    ...typography.body,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: colors.text,
    borderRadius: 18,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  sendButtonText: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '600',
  },
});