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
} from 'react-native';

import { useNavigation } from '@react-navigation/native';

import { colors, spacing, typography, borderRadius } from '../theme';
import { useOnboardingStore } from '../stores/onboardingStore';
import { useUserStore } from '../stores/userStore';
import { apiPost, apiPut } from '../services/api';
import { signOutCurrentUser } from '../services/auth';
import KinAvatar from '../components/KinAvatar';
import ChatMessage from '../components/ChatMessage';
import HorizontalButtons from '../components/HorizontalButtons';
import GoalCard from '../components/GoalCard';
import OptionCard from '../components/OptionCard';
import ActivityIcon, { type ActivityIconName } from '../components/ActivityIcon';
import EquipmentCard from '../components/EquipmentCard';
import type { EquipmentIconName } from '../components/EquipmentIcon';
import ProfileSummaryCard from '../components/ProfileSummaryCard';
import SendIcon from '../components/SendIcon';
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
    setPersonalization,
  } = useOnboardingStore();

  const navigation = useNavigation<any>();
  
  const [inputValue, setInputValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  // Calculate progress percentage based on current step
  const getProgressPercentage = () => {
    const steps = ['welcome', 'name', 'age', 'height', 'weight', 'gender', 'goals', 'activity_level', 'location', 'equipment', 'injuries', 'duration', 'fitness_level', 'experience', 'preferences', 'summary', 'complete'];
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

  // Personalization is triggered by the "Build My Plan" button on the summary
  // card (see the 'summary' step), not automatically.

  const handlePersonalization = async () => {
    setProcessing(true);
    try {
      // 1. Persist the collected profile. The backend's /api/personalize reads
      //    from the saved user document (not the request body), so we must save
      //    everything first.
      await apiPut('/api/profile', {
        name: data.name,
        age: data.age,
        height_cm: data.height_cm,
        weight_kg: data.weight_kg,
        gender: data.gender ?? 'prefer_not_to_say',
        fitness_goal: data.fitness_goal,
        activity_level: data.activity_level,
        workout_location: data.workout_location,
        equipment: data.equipment.length ? data.equipment : ['none'],
        injuries: data.injuries.length ? data.injuries : ['none'],
        injury_notes: data.injury_notes,
        workout_duration: data.workout_duration,
        prior_program_experience: data.prior_program_experience ?? false,
        companion_preferences: {
          voice_id: 'default',
          talkativeness: data.talkativeness || 'balanced',
          in_session_verbosity: 'standard',
        },
      });

      // 2. Run personalization — calculates metrics + persona tags from the
      //    saved profile and returns them.
      const response = await apiPost<PersonalizeResponse>('/api/personalize', {});

      addMessage('kin', "Perfect! I've built your plan. Here's a quick snapshot of where you're starting from.");

      setPersonalization(response.calculated_metrics, response.persona_tags);

      setTimeout(() => {
        navigation.navigate('HealthMetrics');
      }, 1200);
    } catch (error) {
      // Don't auto-retry in a loop — surface the issue once.
      addMessage('kin', "I couldn't finish setting up your plan just now. Please check your connection and tap send to try again.");
      if (__DEV__) console.warn('Personalization failed:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getStepContent = () => {
    switch (currentStep) {
      case 'age':
        return {
          buttons: [
            { label: '18 years', value: '18' },
            { label: '25 years', value: '25' },
            { label: '30 years', value: '30' },
            { label: '35 years', value: '35' },
            { label: '40 years', value: '40' },
            { label: '45 years', value: '45' },
            { label: '50 years', value: '50' },
            { label: '55 years', value: '55' },
            { label: '60 years', value: '60' },
          ],
          inputPlaceholder: 'e.g. 32',
          inputSuffix: 'years',
          inputType: 'numeric' as const,
          validate: (value: string) => {
            const age = parseInt(value);
            return age >= 16 && age <= 100;
          },
          onButtonPress: (value: string) => {
            updateData('age', parseInt(value));
            addMessage('user', `${value} years`);
            addMessage('kin', `Got it! What's your height? I can work with feet/inches or centimeters.`);
            nextStep();
          },
          onSubmit: (value: string) => {
            const age = parseInt(value);
            updateData('age', age);
            addMessage('user', `${age} years`);
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
            addMessage('kin', `Thanks! Which of these best describes you?`);
            nextStep();
          },
        };

      case 'gender':
        return {
          buttons: [
            { label: 'Male', value: 'male' },
            { label: 'Female', value: 'female' },
            { label: 'Other', value: 'other' },
            { label: 'Prefer not to say', value: 'prefer_not_to_say' },
          ],
          onButtonPress: (value: string) => {
            updateData('gender', value);
            const label =
              value === 'prefer_not_to_say'
                ? 'Prefer not to say'
                : value.charAt(0).toUpperCase() + value.slice(1);
            addMessage('user', label);
            addMessage('kin', `What's your main fitness goal? I want to make sure we're working toward what matters to you.`);
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
            addMessage('kin', `Have you followed a structured workout program before?`);
            nextStep();
          },
        };

      case 'goals':
        return {
          gridCards: [
            { value: 'strength', title: 'Strength', subtitle: 'Build raw power', tint: '#EAF2FB', iconColor: '#4A90C2' },
            { value: 'hypertrophy', title: 'Hypertrophy', subtitle: 'Gain muscle size', tint: '#ECEBFB', iconColor: '#5B6CC2' },
            { value: 'mobility', title: 'Mobility', subtitle: 'Move better, feel better', tint: '#E8F6EE', iconColor: '#34A853' },
            { value: 'general_fitness', title: 'General Fitness', subtitle: 'Overall wellness', tint: '#EAF2FB', iconColor: '#4A90C2' },
            { value: 'weight_loss', title: 'Weight Loss', subtitle: 'Burn fat, slim down', tint: '#E8F1FB', iconColor: '#4A90C2' },
            { value: 'home_workout', title: 'Home Workout', subtitle: 'Train anywhere', tint: '#FDF0E6', iconColor: '#E8772E' },
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
          cardList: [
            { value: 'sedentary', title: 'Sedentary', subtitle: 'New to working out', tint: '#E8F6EE', iconColor: '#34A853', icon: 'leaf' as ActivityIconName },
            { value: 'lightly_active', title: 'Lightly Active', subtitle: 'Work out here and there', tint: '#EAF2FB', iconColor: '#4A90C2', icon: 'pulse' as ActivityIconName },
            { value: 'moderately_active', title: 'Moderately Active', subtitle: 'Regular workouts', tint: '#FDF0E6', iconColor: '#E8772E', icon: 'bolt' as ActivityIconName },
            { value: 'very_active', title: 'Very Active', subtitle: 'Train consistently', tint: '#F3EEFB', iconColor: '#7B61C2', icon: 'trophy' as ActivityIconName },
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
          equipmentGrid: [
            { label: 'None', value: 'none', tint: '#E8F6EE', iconColor: '#34A853' },
            { label: 'Dumbbells', value: 'dumbbells', tint: '#EAF2FB', iconColor: '#4A90C2' },
            { label: 'Barbell', value: 'barbell', tint: '#ECEBFB', iconColor: '#5B6CC2' },
            { label: 'Resistance Bands', value: 'resistance_bands', tint: '#FDF0E6', iconColor: '#E8772E' },
            { label: 'Kettlebell', value: 'kettlebell', tint: '#F3EEFB', iconColor: '#7B61C2' },
            { label: 'Pull-up Bar', value: 'pull_up_bar', tint: '#EAF2FB', iconColor: '#4A90C2' },
            { label: 'Bench', value: 'bench', tint: '#E8F1FB', iconColor: '#4A90C2' },
            { label: 'Gym Machines', value: 'machines', tint: '#FDF0E6', iconColor: '#E8772E' },
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
            addMessage('kin', `How would you describe your current fitness level?`);
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
            addMessage('kin', `Perfect. I can work with that.`);
            addMessage('kin', `Here's a quick summary before I build your plan.`);
            nextStep();
          },
        };

      case 'summary':
        // No input/buttons — the ProfileSummaryCard (with its "Build My Plan"
        // button) is rendered in the message area for this step.
        return {};

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
            <Pressable 
              style={styles.logoutButton}
              onPress={() => signOutCurrentUser()}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>{getProgressPercentage()}% complete</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${getProgressPercentage()}%` }]} />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((item) => (
          <ChatMessage key={item.id} role={item.role} content={item.content} />
        ))}
        {currentStep === 'summary' && (
          <ProfileSummaryCard
            data={data}
            loading={isProcessing}
            onBuild={handlePersonalization}
          />
        )}
      </ScrollView>

      {/* Goal cards — special 2-column grid for the fitness goal step */}
      {stepContent.gridCards && (
        <View style={styles.gridContainer}>
          {stepContent.gridCards.map((card) => (
            <GoalCard
              key={card.value}
              goal={card.value as any}
              title={card.title}
              subtitle={card.subtitle}
              tint={card.tint}
              iconColor={card.iconColor}
              onPress={() => handleButtonPress(card.value)}
            />
          ))}
        </View>
      )}

      {/* Equipment cards — 2-column multi-select grid for the equipment step */}
      {stepContent.equipmentGrid && (
        <View style={styles.buttonsContainer}>
          <View style={styles.gridContainer}>
            {stepContent.equipmentGrid.map((card) => (
              <EquipmentCard
                key={card.value}
                value={card.value as EquipmentIconName}
                label={card.label}
                tint={card.tint}
                iconColor={card.iconColor}
                selected={selectedOptions.includes(card.value)}
                onPress={() => handleButtonPress(card.value)}
              />
            ))}
          </View>
          <View style={styles.continueButtonContainer}>
            <Pressable style={styles.continueButton} onPress={handleMultiSelectContinue}>
              <Text style={styles.continueText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Option cards — full-width single-column list (e.g. activity level) */}
      {stepContent.cardList && (
        <View style={styles.cardListContainer}>
          {stepContent.cardList.map((card) => (
            <OptionCard
              key={card.value}
              icon={<ActivityIcon name={card.icon} color={card.iconColor} />}
              title={card.title}
              subtitle={card.subtitle}
              tint={card.tint}
              onPress={() => handleButtonPress(card.value)}
            />
          ))}
        </View>
      )}

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

      {/* Input — shown whenever the step accepts typed input (age shows both
          the quick-pick buttons above AND this input). */}
      {stepContent.inputPlaceholder && (
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
          {!!stepContent.inputSuffix && (
            <Text style={styles.inputSuffix}>{stepContent.inputSuffix}</Text>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              (!inputValue.trim() || isProcessing) && styles.sendButtonDisabled,
              pressed && inputValue.trim() && !isProcessing && styles.sendButtonPressed,
            ]}
            onPress={handleSubmit}
            disabled={!inputValue.trim() || isProcessing}
          >
            <SendIcon size={32} />
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
    marginTop: 12,
  },
  progressText: {
    fontSize: 11,
    color: colors.surface,
    opacity: 0.8,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  progressBar: {
    width: 64,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1.5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.surface,
    borderRadius: 1.5,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-end',
  },
  logoutText: {
    fontSize: 12,
    color: colors.surface,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingVertical: spacing.md,
    flexGrow: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  cardListContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
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
  inputSuffix: {
    ...typography.body,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.25,
  },
  sendButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
});