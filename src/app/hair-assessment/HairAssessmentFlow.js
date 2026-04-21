"use client";

import React, { useState, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight, FaTimes, FaCamera, FaCheckCircle, FaTrashAlt, FaClock, FaInfoCircle, FaHeart, FaCheck, FaShieldAlt, FaLightbulb, FaLock, FaMagic, FaSearchPlus, FaGift, FaHeartbeat, FaChartBar, FaStethoscope, FaCalendarAlt, FaEnvelope, FaMapMarkerAlt, FaArrowRight, FaHospital, FaMapPin, FaCaretUp, FaSpinner } from 'react-icons/fa';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/redux/hooks';
import { toast } from 'react-toastify';
import './HairAssessmentFlow.css';
import {
  fetchAssessmentQuestionsThunk,
  createSessionThunk,
  updateAnswersThunk,
  triggerAnalysisThunk,
  checkSessionStatusThunk,
  createLeadThunk,
  finalizeQuizThunk,
  uploadImageThunk,
  verifyOtpThunk,
} from '@/redux/slices/hairAssessmentSlice';

const normalizeText = (val) => String(val ?? '').trim().toLowerCase();
const normalizeRuleId = (ruleId) => String(ruleId ?? '').trim().toUpperCase().replace(/_/g, '-');
const isSuccessResponse = (value) => {
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
};
const normalizeQuestionId = (questionId) => String(questionId ?? '').trim().toUpperCase();

const parseListLikeValue = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [value];

  const clean = value.trim();
  if (!(clean.includes(',') || (clean.startsWith('[') && clean.endsWith(']')))) {
    return [clean];
  }

  const inner = clean.startsWith('[') && clean.endsWith(']')
    ? clean.substring(1, clean.length - 1)
    : clean;

  return inner
    .split(',')
    .map(v => v.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
};

const getComparableTokens = (value) => {
  const values = Array.isArray(value) ? value : [value];
  const tokens = new Set();

  values.forEach((item) => {
    const normalized = normalizeText(item);
    if (!normalized) return;

    tokens.add(normalized);
    tokens.add(normalized.replace(/\s+/g, '_'));
    tokens.add(normalized.replace(/\s+/g, '-'));
    tokens.add(normalized.replace(/[_-]+/g, '_'));
    tokens.add(normalized.replace(/[_-]+/g, '-'));
    tokens.add(normalized.replace(/^yes[_-]+/, ''));
  });

  tokens.delete('');
  return tokens;
};

const answerMatches = (answers, questionId, expectedValues) => {
  const userTokens = getComparableTokens(answers?.[questionId]);
  if (!userTokens.size) return false;

  return expectedValues.some((expected) => {
    const expectedTokens = getComparableTokens(expected);
    return Array.from(expectedTokens).some((token) => userTokens.has(token));
  });
};

/* =========================================================
   NEW BRANCHING LOGIC ENGINE (DSE ALIGNED)
   ========================================================= */

const BRANCHING_RULES = [
  {
    id: "BR_001_MALE_ROUTING",
    description: "Activate male-specific questions",
    trigger: (answers) => answers["Q_S01_002"] === "male",
    activates: [] // Norwood selector is removed from new set
  },
  {
    id: "BR_002_FEMALE_ROUTING",
    description: "Activate female-specific questions",
    trigger: (answers) => answers["Q_S01_002"] === "female",
    activates: ["Q_S04_009", "Q_S10_001", "Q_S10_002", "Q_S10_003", "Q_S10_004", "Q_S10_005"]
  },
  {
    id: "BR_003_RAPID_ONSET",
    description: "Activate rapid onset questions",
    trigger: (answers) => ["lt_3_months", "3_6_months"].includes(answers["Q_S02_001"]) && answers["Q_S02_002"] === "sudden",
    activates: [] // Extended Qs are removed from new set
  },
  {
    id: "BR_004_SCALP_CONDITION",
    description: "Activate itching + scaling deep questions",
    trigger: (answers) => (answers["Q_S07_001"] && answers["Q_S07_001"] !== "none") && (answers["Q_S07_003"] && answers["Q_S07_003"] !== "none"),
    activates: []
  },
  {
    id: "BR_005_CHEMICAL_TREATMENT",
    description: "Activate chemical treatment questions",
    trigger: (answers) => answers["Q_S06_003"] && answers["Q_S06_003"] !== "never",
    activates: []
  },
  {
    id: "BR_006_SOUTH_ASIAN",
    description: "Activate region-specific questions",
    trigger: (answers) => answers["Q_S01_003"] === "south_asian",
    activates: [] 
  },
  {
    id: "BR_007_PATERNAL_GENETIC",
    description: "Activate genetic deep questions",
    trigger: (answers) => ["paternal", "both"].includes(answers["Q_S03_001"]),
    activates: []
  },
  {
    id: "BR_008_HIGH_STRESS",
    description: "Activate stress-related questions",
    trigger: (answers) => ["high", "extreme"].includes(answers["Q_S05_001"]),
    activates: []
  }
];

function getActiveQuestions(answers) {
  const activeQuestionIds = new Set();
  
  // Normalize all keys in answers for reliable trigger evaluation
  const normalizedAnswers = {};
  Object.keys(answers).forEach(k => {
    normalizedAnswers[normalizeQuestionId(k)] = answers[k];
  });

  BRANCHING_RULES.forEach(rule => {
    if (rule.trigger(normalizedAnswers)) {
      if (rule.activates) {
        rule.activates.forEach(qId => activeQuestionIds.add(normalizeQuestionId(qId)));
      }
    }
  });
  return Array.from(activeQuestionIds);
}

function validateActivePath(ruleId, answers) {
  const rule = BRANCHING_RULES.find(r => normalizeRuleId(r.id) === normalizeRuleId(ruleId));
  if (!rule) return false;
  
  const normalizedAnswers = {};
  Object.keys(answers).forEach(k => {
    normalizedAnswers[normalizeQuestionId(k)] = answers[k];
  });
  
  return rule.trigger(normalizedAnswers);
}

/* Shared Shield Icon */
const ShieldIcon = () => (
  <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 0L0 3.11111V7.77778C0 12.1333 2.98667 16.1778 7 17.1111C11.0133 16.1778 14 12.1333 14 7.77778V3.11111L7 0Z" fill="#00E5FF" fillOpacity="0.1" />
    <path d="M7 1.55556L1.55556 4V7.77778C1.55556 11.2356 3.86667 14.4444 7 15.2889C10.1333 14.4444 12.4444 11.2356 12.4444 7.77778V4L7 1.55556Z" stroke="#00E5FF" strokeWidth="1.5" />
    <path d="M4.66663 8.55556L6.22218 10.1111L9.3333 6.99998" stroke="#00E5FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PhotoSecureIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 13V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22H13.5" stroke="#0ED7B5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 17.5V18.5C22 20.43 20.43 22 18.5 22C16.57 22 15 20.43 15 18.5V17.5C15 17.22 15.22 17 15.5 17H21.5C21.78 17 22 17.22 22 17.5Z" stroke="#0ED7B5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 17V16C17 15.17 17.67 14.5 18.5 14.5C19.33 14.5 20 15.17 20 16V17" stroke="#0ED7B5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.5 8C10.5 9.38 9.38 10.5 8 10.5C6.62 10.5 5.5 9.38 5.5 8C5.5 6.62 6.62 5.5 8 5.5C9.38 5.5 10.5 6.62 10.5 8Z" stroke="#0ED7B5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.67 18.95L7.6 15.64C8.39 15.11 9.53 15.17 10.24 15.78L10.57 16.07C11.35 16.74 12.61 16.74 13.39 16.07" stroke="#0ED7B5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HairAssessmentFlow = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [locationSearch, setLocationSearch] = useState('');
  const navigate = (to, options = {}) => {
    if (typeof to === 'number') {
      if (to < 0) {
        router.back();
      }
      return;
    }

    if (options?.replace) {
      router.replace(to);
      return;
    }

    router.push(to);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLocationSearch(window.location.search || '');
    }
  }, []);
  const [currentView, setCurrentView] = useState("diagnostic"); // "diagnostic" or "ai-analysis"
  const [aiSubStep, setAiSubStep] = useState('intro'); // 'intro', 'upload', 'processing', 'results'
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({});

  // API Data State
  const [sections, setSections] = useState([]);
  const [hiddenQuestions, setHiddenQuestions] = useState([]); // Questions in 'inject' array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Validation State for Step 1
  const [userInfo, setUserInfo] = useState({ fullName: '', phone: '' });
  const [userErrors, setUserErrors] = useState({ fullName: '', phone: '' });
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        const response = await dispatch(fetchAssessmentQuestionsThunk()).unwrap();
        if (response.success && response.data.sections) {
          setSections(response.data.sections);
          setHiddenQuestions(response.data.inject || []);
        } else {
          setError("Failed to load assessment questions");
        }
      } catch (err) {
        setError("Error connecting to server. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentStep, currentView]);

  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const focus = params.get('focus');
    const openUploadDirectly = focus === 'photo-upload' || params.get('step') === 'upload';
    const openAiPhotoSection = focus === 'photo-analysis' || openUploadDirectly;

    if (!openAiPhotoSection) return;

    let isCancelled = false;

    const openTargetSection = async () => {
      let existingSessionId = localStorage.getItem('hair_assessment_session_id');

      // If no existing session is present, create one so we don't bounce to prep/start page.
      if (!existingSessionId) {
        try {
          const response = await dispatch(createSessionThunk()).unwrap();
          if (response?.success && response?.data?.sessionId) {
            existingSessionId = response.data.sessionId;
            localStorage.setItem('hair_assessment_session_id', existingSessionId);
            if (response.data.sessionToken) {
              localStorage.setItem('hair_assessment_token', response.data.sessionToken);
            }
          }
        } catch (error) {
          console.error('Session creation failed for AI photo deep-link:', error);
        }
      }

      if (isCancelled) return;

      if (!existingSessionId) {
        navigate('/hair-test-assessment');
        return;
      }

      setCurrentView('ai-analysis');
      setAiSubStep(openUploadDirectly ? 'upload' : 'intro');
    };

    openTargetSection();

    return () => {
      isCancelled = true;
    };
  }, [locationSearch, dispatch, router]);

  const handleOptionSelect = async (qId, option, isMulti = false) => {
    // 1. Calculate the NEW value
    let newValue;
    if (isMulti) {
      const current = selectedOptions[qId] || [];
      const isSelected = current.includes(option);
      newValue = isSelected ? current.filter(o => o !== option) : [...current, option];
    } else {
      newValue = option;
    }

    // 2. Identify and Clean Branching Side-Effects
    let finalNextOptions = { ...selectedOptions, [qId]: newValue };

    // Always calculate new visible ids
    const visibleIds = getVisibleQuestionIds(finalNextOptions);
    const cleanedOptions = {};
    
    Object.keys(finalNextOptions).forEach(id => {
      if (visibleIds.has(id)) {
        cleanedOptions[id] = finalNextOptions[id];
      }
    });

    finalNextOptions = cleanedOptions;
    setSelectedOptions(finalNextOptions);
  };

  const getQuestionById = (qId) => {
    for (const section of sections) {
      const found = section.questions?.find(q => q.id === qId);
      if (found) return found;
    }
    return null;
  };

  const getVisibleQuestionIds = (currentOptions) => {
    const visibleIds = new Set();
    const activeFromRules = new Set(getActiveQuestions(currentOptions));
    
    // 1. Inject (hiddenQuestions) mapping from API
    const allConditionalIds = new Set(
      hiddenQuestions.map(q => {
        if (typeof q === 'string') return normalizeQuestionId(q);
        return normalizeQuestionId(q.id || q.questionId || q.qid || q.q);
      }).filter(Boolean)
    );

    // 2. Identify all IDs that appear in rules as "activated" components.
    // If a question is activated by a rule, it is inherently conditional.
    const ruleGatedIds = new Set();
    BRANCHING_RULES.forEach(rule => {
      if (rule.activates) {
        rule.activates.forEach(aid => ruleGatedIds.add(normalizeQuestionId(aid)));
      }
    });

    sections.forEach(section => {
      section.questions.forEach(q => {
        const qIdRaw = q.id;
        const qIdNormalized = normalizeQuestionId(qIdRaw);
        
        // A question is visible if:
        // 1. It is NOT conditional (checked via API flag, local inject list, or local rule set)
        // 2. OR it is explicitly activated by a currently triggered rule
        const isConditional = q.isConditional === true || 
                             !!q.conditional || 
                             allConditionalIds.has(qIdNormalized) ||
                             ruleGatedIds.has(qIdNormalized);

        if (!isConditional || activeFromRules.has(qIdNormalized)) {
          visibleIds.add(qIdRaw);
        }
      });
    });

    return visibleIds;
  };

  const getDisplayedQuestions = (section) => {
    if (!section) return [];
    const visibleIds = getVisibleQuestionIds(selectedOptions);
    return section.questions.filter(q => visibleIds.has(q.id));
  };

  const menuItems = sections
    .map((s, idx) => ({
      label: s.title.split(' ')[0], // Simpler labels for tabs
      step: idx + 1,
      fullTitle: s.title,
      visible: getDisplayedQuestions(s).length > 0
    }))
    .filter(item => item.visible);


  const activeSection = sections[currentStep - 1] || null;
  const displayedQuestions = getDisplayedQuestions(activeSection);

  // Dynamic calculation for progress tracker
  // Step 1 includes Full Name + Phone Number + API Questions
  const profileFieldsCount = currentStep === 1 ? 2 : 0;
  const mandatoryInSection = displayedQuestions.filter(q => q.mandatory).length + profileFieldsCount;

  const profileAnsweredCount = currentStep === 1
    ? (userInfo.fullName.trim() !== '' ? 1 : 0) + (userInfo.phone.length === 10 ? 1 : 0)
    : 0;

  const answeredMandatoryCount = displayedQuestions.filter(q => {
    if (!q.mandatory) return false;
    const val = selectedOptions[q.id];
    if (q.type === 'MULTI_SELECT') return val && val.length > 0;
    return val !== undefined && val !== '';
  }).length + profileAnsweredCount;

  const totalAnswered = displayedQuestions.filter(q => {
    const val = selectedOptions[q.id];
    if (q.type === 'MULTI_SELECT') return val && val.length > 0;
    return val !== undefined && val !== '';
  }).length + profileAnsweredCount;

  const handleUserInfoChange = (e) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      // Only allow numbers and max 10 digits
      const cleaned = value.replace(/\D/g, '').slice(0, 10);
      setUserInfo(prev => ({ ...prev, [name]: cleaned }));

      if (cleaned.length > 0 && cleaned.length < 10) {
        setUserErrors(prev => ({ ...prev, phone: 'Phone number must be 10 digits' }));
      } else if (cleaned.length === 0) {
        setUserErrors(prev => ({ ...prev, phone: 'Phone number is required' }));
      } else {
        setUserErrors(prev => ({ ...prev, phone: '' }));
        // Persist for Lead Gate
        localStorage.setItem('user_phone', cleaned);
      }
    } else {
      setUserInfo(prev => {
        const updated = { ...prev, [name]: value };
        // Also store in localStorage for the Lead Gate
        localStorage.setItem('user_full_name', value);
        return updated;
      });
      if (value.trim() === '') {
        setUserErrors(prev => ({ ...prev, fullName: 'Full name is required' }));
      } else {
        setUserErrors(prev => ({ ...prev, fullName: '' }));
      }
    }
  };

  const isProfileValid = currentStep === 1
    ? (userInfo.fullName.trim() !== '' && userInfo.phone.length === 10 && userErrors.fullName === '' && userErrors.phone === '')
    : true;

  const validateSection = (questions) => {
    const allAnswered = questions.every(q => {
      const val = selectedOptions[q.id];
      const isAnswered = q.type === 'MULTI_SELECT' ? (val && val.length > 0) : (val !== undefined && val !== '');

      if (!isAnswered) return !q.mandatory;

      // Range Validation for NUMERIC
      if (q.type === 'NUMERIC') {
        const num = Number(val);
        if ((q.min !== undefined && num < q.min) || (q.max !== undefined && num > q.max)) return false;
      }

      // No Numbers validation for City/Region
      if (q.type === 'FREE_TEXT' && (q.text.toLowerCase().includes('city') || q.text.toLowerCase().includes('region'))) {
        if (/\d/.test(val)) return false;
      }

      return true;
    });
    return allAnswered && isProfileValid;
  };

  const hasAnswerForQuestion = (questionId) => {
    const value = selectedOptions[questionId];
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== undefined && value !== null && value !== '';
  };

  const validateMandatoryClinicalBranches = () => {
    const visibleIds = getVisibleQuestionIds(selectedOptions);
    const allQuestions = sections.flatMap((section) => section.questions || []);
    const missing = allQuestions
      .filter((question) => question.mandatory && visibleIds.has(question.id))
      .map((question) => question.id)
      .filter((questionId) => !hasAnswerForQuestion(questionId));

    if (missing.length === 0) {
      return true;
    }

    const firstMissingId = missing[0];
    const sectionIndex = sections.findIndex((section) =>
      section.questions.some((q) => q.id === firstMissingId)
    );

    if (sectionIndex >= 0) {
      setCurrentStep(sectionIndex + 1);
    }

    setShowErrors(true);
    toast.error(`Mandatory branch questions missing: ${missing.join(', ')}`);
    return false;
  };

  const handleNextStep = async () => {
    if (activeSection) {
      if (validateSection(displayedQuestions)) {
        // SYNC ANSWERS FOR CURRENT SECTION (BATCH)
        const sessionId = localStorage.getItem('hair_assessment_session_id');
        if (sessionId) {
          try {
            // Collect answers for questions currently visible in this section
            const sectionAnswers = displayedQuestions
              .map(q => ({
                questionId: q.id,
                value: selectedOptions[q.id]
              }))
              .filter(a => a.value !== undefined && a.value !== null);

            if (sectionAnswers.length > 0) {
              await dispatch(updateAnswersThunk({ sessionId, answersData: sectionAnswers })).unwrap();
            }
          } catch (err) {
            console.error("Batch sync failed:", err);
          }
        }

        if (currentStep < sections.length) {
          // Skip sections that have no visible questions due to branching rules
          let nextStepNum = currentStep + 1;
          while (nextStepNum <= sections.length) {
            const nextSec = sections[nextStepNum - 1];
            if (getDisplayedQuestions(nextSec).length > 0) {
              break;
            }
            nextStepNum++;
          }

          if (nextStepNum > sections.length) {
            // If No more sections have visible questions, attempt to finalize
            if (!validateMandatoryClinicalBranches()) return;
            try {
              const sessionId = localStorage.getItem('hair_assessment_session_id');
              const finalizeResponse = await dispatch(finalizeQuizThunk(sessionId)).unwrap();
              if (isSuccessResponse(finalizeResponse?.success)) {
                setCurrentView("ai-analysis");
                setAiSubStep("intro");
              } else {
                toast.error("Unable to finalize results.");
              }
            } catch (e) {
              console.error(e);
            }
          } else {
            setCurrentStep(nextStepNum);
          }
        } else {
          if (!validateMandatoryClinicalBranches()) {
            return;
          }

          // PHASE 2 Finalization
          try {
            const sessionId = localStorage.getItem('hair_assessment_session_id');
            if (!sessionId) {
              toast.error('Session missing. Please restart the assessment before continuing.');
              return;
            }

            const finalizeResponse = await dispatch(finalizeQuizThunk(sessionId)).unwrap();
            if (!isSuccessResponse(finalizeResponse?.success)) {
              throw new Error(finalizeResponse?.message || 'Questionnaire finalization failed');
            }
            setCurrentView("ai-analysis");
            setAiSubStep("intro");
          } catch (error) {
            console.error("Quiz completion error:", error);
            toast.error("Unable to finalize questionnaire. Please complete pending answers and try again.");
            return;
          }
        }
      } else {
        setShowErrors(true);
      }
    }
  };

  const renderSectionContent = () => {
    if (!activeSection) return null;

    return (
      <>
        <SectionProgressTracker
          sectionName={activeSection.title}
          total={mandatoryInSection}
          answered={answeredMandatoryCount}
          numMode={currentStep !== 1}
        />

        {currentStep === 1 && (
          <div className="flow-card">
            <div className="card-header">
              <h3 className="card-title-main">Basic Information</h3>
              <p className="card-subtitle-main">Help us personalize your report and securely save your results</p>
            </div>
            <div className="input-group">
              <label className="input-label">Full Name <span style={{ color: '#ff4d4d' }}>*</span></label>
              <input
                type="text"
                name="fullName"
                className={`flow-input ${(userErrors.fullName || (showErrors && !userInfo.fullName)) ? 'input-error' : ''}`}
                placeholder="Enter your full name"
                value={userInfo.fullName}
                onChange={handleUserInfoChange}
              />
              {(userErrors.fullName || (showErrors && !userInfo.fullName)) && <span className="field-error-msg">{userErrors.fullName || "Full name is required"}</span>}
            </div>
            <div className="input-group">
              <label className="input-label">Phone Number <span style={{ color: '#ff4d4d' }}>*</span></label>
              <input
                type="text"
                name="phone"
                className={`flow-input ${(userErrors.phone || (showErrors && userInfo.phone.length < 10)) ? 'input-error' : ''}`}
                placeholder="Enter your mobile number"
                value={userInfo.phone}
                onChange={handleUserInfoChange}
                maxLength="10"
              />
              {(userErrors.phone || (showErrors && userInfo.phone.length < 10)) && <span className="field-error-msg">{userErrors.phone || "Phone number must be 10 digits"}</span>}
            </div>
            <div className="card-footer-info">
              <p className="usage-note">We'll use this to generate and share your personalized hair report.</p>
              <div className="privacy-note">
                <ShieldIcon />
                <span>Your information is protected and will not be shared.</span>
              </div>
            </div>
          </div>
        )}

        {displayedQuestions.map((q, idx) => (
          <DynamicQuestionCard
            key={q.id}
            index={currentStep === 1 ? idx + 3 : idx + 1}
            question={q}
            selectedValue={selectedOptions[q.id]}
            onSelect={(val) => {
              handleOptionSelect(q.id, val, q.type === 'MULTI_SELECT');
              if (showErrors) setShowErrors(false);
            }}
            showError={showErrors && (
              (q.mandatory && (q.type === 'MULTI_SELECT' ? !(selectedOptions[q.id]?.length > 0) : !selectedOptions[q.id])) ||
              (q.type === 'NUMERIC' && selectedOptions[q.id] && (
                (q.min !== undefined && Number(selectedOptions[q.id]) < q.min) ||
                (q.max !== undefined && Number(selectedOptions[q.id]) > q.max)
              )) ||
              (q.type === 'FREE_TEXT' && selectedOptions[q.id] && (q.text.toLowerCase().includes('city') || q.text.toLowerCase().includes('region')) && /\d/.test(selectedOptions[q.id]))
            )}
          />
        ))}
      </>
    );
  };

  if (currentView === "ai-analysis") {
    const sessionId = localStorage.getItem('hair_assessment_session_id');
    return (
      <AiAnalysisView
        sessionId={sessionId}
        subStep={aiSubStep}
        setSubStep={setAiSubStep}
        onBack={() => setCurrentView("diagnostic")}
        onNext={() => setCurrentStep(prev => prev + 1)}
        userProfile={userInfo}
      />
    );
  }

  if (loading) {
    return (
      <div className="hair-flow-container">
        <header className="prep-header">
          <div className="header-left-group">
            <div className="back-btn"><FaChevronLeft /> BACK</div>
            <div className="header-divider"></div>
            <div className="prep-logo"><img src="/reportlogo.png" alt="HairSnCare" /></div>
          </div>
          <div className="shimmer-active shimmer-tab-item" style={{ width: 80, height: 20 }}></div>
        </header>

        <main className="flow-content shimmer-wrapper">
          <div className="shimmer-active shimmer-hero"></div>

          <div className="shimmer-tabs">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => <div key={i} className="shimmer-active shimmer-tab-item"></div>)}
          </div>

          <div className="shimmer-active" style={{ height: 120, marginBottom: 24 }}></div>

          <div className="shimmer-active" style={{ padding: 24 }}>
            <div className="shimmer-title" style={{ width: '60%' }}></div>
            <div className="shimmer-text"></div>
            <div className="shimmer-options">
              {[1, 2].map(i => <div key={i} className="shimmer-opt-btn shimmer-active"></div>)}
            </div>
          </div>

          {[1, 2, 3].map(i => (
            <div key={i} className="shimmer-active shimmer-card" style={{ padding: 24 }}>
              <div className="shimmer-title"></div>
              <div className="shimmer-text"></div>
              <div className="shimmer-options">
                {[1, 2, 3, 4].map(j => <div key={j} className="shimmer-opt-btn shimmer-active"></div>)}
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hair-flow-container error-state">
        <div className="error-box">
          <FaInfoCircle />
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hair-flow-container">
      <header className="prep-header">
        <div className="header-left-group">
          <button className="back-btn" onClick={() => window.history.back()}>
            <FaChevronLeft /> BACK
          </button>
          <div className="header-divider"></div>
          <div className="prep-logo">
            <img src="/reportlogo.png" alt="HairSnCare" />
          </div>
        </div>
        <div className="step-indicator">
          Step {currentStep.toString().padStart(2, '0')} / {sections.length.toString().padStart(2, '0')}
        </div>
      </header>

      <main className="flow-content">
        <SectionHero
          num={currentStep.toString().padStart(2, '0')}
          sectionLabel={activeSection ? activeSection.title.toUpperCase() : ""}
          title={activeSection ? activeSection.title : ""}
          subtitle={`Completing your ${activeSection ? activeSection.title.toLowerCase() : ""} analysis phase.`}
        />

        <div className="section-tabs-container">
          {menuItems.map((item) => (
            <div
              key={item.step}
              className={`tab-item ${currentStep === item.step ? 'active' : ''} ${currentStep > item.step ? 'completed' : ''} no-click`}
            >
              <div className="tab-progress-line"></div>
              <span className="tab-label">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="diagnostic-view-main">
          {renderSectionContent()}
        </div>

        <div className="flow-actions-footer">
          <div className="answered-summary-bar">
            <strong>{answeredMandatoryCount} of {mandatoryInSection}</strong> mandatory questions answered
          </div>
          <div className="flow-button-row">
            {currentStep > 1 && (
              <button className="flow-prev-btn" onClick={() => {
                let prevStepNum = currentStep - 1;
                while (prevStepNum > 1) {
                  const prevSec = sections[prevStepNum - 1];
                  if (getDisplayedQuestions(prevSec).length > 0) {
                    break;
                  }
                  prevStepNum--;
                }
                setCurrentStep(prevStepNum);
              }}>
                Previous
              </button>
            )}
            <button
              className={`flow-continue-btn ${(!validateSection(displayedQuestions)) ? 'disabled' : ''}`}
              onClick={handleNextStep}
            >
              Continue to {currentStep === sections.length ? 'AI Analysis' : 'Next Section'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

/* Components */

const SectionHero = ({ num, sectionLabel, title, subtitle }) => (
  <div className="section-hero">
    <div className="hero-accent-line"></div>
    <div className="hero-circle">
      {/* Circle placeholder */}
    </div>
    <div className="hero-text">
      <span className="section-label-tag">{sectionLabel}</span>
      <h1 className="section-main-title">{title}</h1>
      <p className="section-main-subtitle">{subtitle}</p>
    </div>
  </div>
);

const DynamicQuestionCard = ({ index, question, selectedValue, onSelect, showError }) => {
  const { id, text, type, options, min, max, mandatory, imageUrl } = question;

  const isSelected = (option) => {
    const candidateValues = [option?.value, option?.id].map(normalizeText).filter(Boolean);

    if (type === 'MULTI_SELECT') {
      const selectedList = Array.isArray(selectedValue) ? selectedValue : [];
      const selectedSet = new Set(selectedList.map(normalizeText));
      return candidateValues.some(v => selectedSet.has(v));
    }

    const selected = normalizeText(selectedValue);
    return candidateValues.some(v => v === selected);
  };

  const renderOptions = () => {
    if (type === 'NUMERIC') {
      return (
        <div className="input-group">
          <input
            type="number"
            className={`flow-input ${showError ? 'input-error' : ''}`}
            placeholder={min && max ? `Enter value (${min}-${max})` : 'Enter value'}
            value={selectedValue || ''}
            onChange={(e) => onSelect(e.target.value)}
            min={min}
            max={max}
          />
        </div>
      );
    }

    if (type === 'FREE_TEXT') {
      return (
        <div className="input-group">
          <input
            type="text"
            className={`flow-input ${showError ? 'input-error' : ''}`}
            placeholder="Type your answer here..."
            value={selectedValue || ''}
            onChange={(e) => {
              const val = e.target.value;
              // If it's a city/region question, optionally strip numbers immediately or just let parent validate
              if (text.toLowerCase().includes('city') || text.toLowerCase().includes('region')) {
                onSelect(val.replace(/[0-9]/g, ''));
              } else {
                onSelect(val);
              }
            }}
          />
        </div>
      );
    }

    if (type === 'SLIDER') {
      return (
        <div className="slider-group">
          <input
            type="range"
            className="flow-slider"
            min={min || 1}
            max={max || 10}
            value={selectedValue || min || 1}
            onChange={(e) => onSelect(e.target.value)}
          />
          <div className="slider-labels">
            <span>Low ({min || 1})</span>
            <span className="slider-value">{selectedValue || min || 1}</span>
            <span>High ({max || 10})</span>
          </div>
        </div>
      );
    }

    if (type === 'IMAGE_SELECT') {
      return (
        <div className="image-options-grid">
          {options.map((opt, index) => {
            // Asset fallback: use shared baldness-one ... baldness-eight set.
            let displayImageUrl = opt.imageUrl;
            if (!displayImageUrl) {
              const baldnessWords = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
              const extractStageNumber = (value) => {
                const match = String(value ?? '').match(/(\d+)/);
                return match ? Number(match[1]) : NaN;
              };

              const stageNumber = extractStageNumber(opt.value) || extractStageNumber(opt.id) || (index + 1);
              const safeIndex = Math.min(Math.max(stageNumber, 1), baldnessWords.length) - 1;
              displayImageUrl = `/assets/img/baldness-${baldnessWords[safeIndex]}.png`;
            }

            return (
              <button
                key={opt.id}
                className={`image-option-btn ${isSelected(opt) ? 'selected' : ''}`}
                onClick={() => onSelect(opt.value ?? opt.id)}
              >
                <div className="image-container">
                  <img src={displayImageUrl} alt={opt.label} />
                </div>
                <div className="image-option-info">
                  <span>{opt.label} Stage {opt.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    // Default for SINGLE_SELECT and MULTI_SELECT
    return (
      <div className={`options-grid ${type === 'MULTI_SELECT' ? 'multi-mode' : ''}`}>
        {options.map((opt) => (
          <button
            key={opt.id}
            className={`option-btn ${isSelected(opt) ? 'selected' : ''}`}
            onClick={() => onSelect(opt.value ?? opt.id)}
          >
            <div className="checkbox-circle">
              {isSelected(opt) && <FaCheck className="check-icon-option" />}
            </div>
            {opt.label}
          </button>
        ))}
      </div>
    );
  };

  const isInvalid = (type === 'NUMERIC' && selectedValue && (
    (min !== undefined && Number(selectedValue) < min) ||
    (max !== undefined && Number(selectedValue) > max)
  )) || (type === 'FREE_TEXT' && selectedValue && (text.toLowerCase().includes('city') || text.toLowerCase().includes('region')) && /\d/.test(selectedValue));

  return (
    <div className={`flow-card ${showError || isInvalid ? 'card-error' : ''}`}>
      <div className="question-header">
        <div className="q-title-box">
          <h3>Q{index} — {text} {mandatory && <span className="mandatory-asterisk" style={{ color: '#ff4d4d', marginLeft: '4px' }}>*</span>}</h3>
          {(showError || isInvalid) && (
            <span className="mandatory-tag">
              {type === 'NUMERIC' && selectedValue && (
                (min !== undefined && Number(selectedValue) < min) ||
                (max !== undefined && Number(selectedValue) > max)
              ) ? `! VALUE MUST BE BETWEEN ${min} AND ${max}` :
                (type === 'FREE_TEXT' && selectedValue && (text.toLowerCase().includes('city') || text.toLowerCase().includes('region')) && /\d/.test(selectedValue))
                  ? '! NUMBERS ARE NOT ALLOWED IN THIS FIELD' : '! PENDING: THIS FIELD IS REQUIRED'}
            </span>
          )}
        </div>
        <div className={`saved-badge ${selectedValue && (Array.isArray(selectedValue) ? selectedValue.length > 0 : true) ? 'visible' : ''}`}>
          <FaCheck className="check-icon-small" /> Saved
        </div>
      </div>

      {/* CUSTOM ZONE UI INJECTION */}
      {(() => {
        const upText = text.toUpperCase();
        const isZoneQuestion = upText.includes("ZONE DENSITY");
        if (isZoneQuestion) {
          let highlightedZone = null;
          if (upText.includes("FRONTAL")) highlightedZone = "frontal";
          else if (upText.includes("MID-SCALP")) highlightedZone = "mid";
          else if (upText.includes("CROWN")) highlightedZone = "crown";

          if (highlightedZone) {
            return <ZoneReferenceGuide highlightedZone={highlightedZone} />;
          }
        }
        return null;
      })()}

      {renderOptions()}
    </div>
  );
};

const ZoneReferenceGuide = ({ highlightedZone }) => {
  const zones = [
    { id: 'frontal', label: 'Frontal', idText: 'FRONTAL ZONE', description: 'from the hairline to ~3 finger-widths back', color: '#F4C430' },
    { id: 'mid', label: 'mid-scalp', idText: 'MID-SCALP ZONE', description: 'centre-top of the head, the parting area', color: '#00E5FF' },
    { id: 'crown', label: 'crown', idText: 'CROWN ZONE', description: 'back-top, the "whorl" area', color: '#A855F7' },
  ];

  return (
    <div className="zone-ref-guide-card">
      <div className="zone-diagram-box">
        <div className="zone-image-display">
          {(() => {
            const imgMap = {
              'frontal': '/Frontalzone.png',
              'mid': '/midscalpzone.png',
              'crown': '/crownzone.png'
            };
            return (
              <img 
                src={imgMap[highlightedZone]} 
                alt={`${highlightedZone} zone`} 
                className="active-zone-visual"
              />
            );
          })()}
          <div className="zone-visual-glowing-ring"></div>
        </div>
        <div className="highlight-indicator">
          <FaCaretUp /> HIGHLIGHTED ZONE
        </div>
      </div>

      <div className="zone-legend-box">
        <div className="legend-header">
          <FaMapPin className="pin-icon" /> ZONE REFERENCE GUIDE
        </div>
        <div className="legend-items">
          {zones.map(z => (
            <div key={z.id} className="legend-item">
              <div className="dot" style={{ backgroundColor: z.id === 'frontal' ? '#F4C430' : z.id === 'mid' ? '#00E5FF' : '#A855F7' }}></div>
              <p><strong>{z.label}</strong> — {z.description}</p>
            </div>
          ))}
        </div>

        <div className="zone-tip-box">
          <FaLightbulb className="tip-icon" />
          <p><strong>Tip:</strong> Stand under bright overhead light and take a phone photo from directly above to clearly see which zone is affected.</p>
        </div>
      </div>
    </div>
  );
};

const SectionProgressTracker = ({ sectionName, total, answered, numMode = true }) => (
  <div className={`flow-card section-progress-card ${!numMode ? 'checkmark-mode' : 'number-mode'}`}>
    <div className="progress-card-info">
      <h4 className="progress-section-name">{sectionName}</h4>
      <div className="progress-marks-row">
        {[...Array(total)].map((_, i) => (
          <div key={i} className={`progress-mark ${i < answered ? 'completed' : ''}`}>
            {numMode ? (i + 1) : <FaCheck className="progress-check-icon" />}
          </div>
        ))}
      </div>
      <p className="remaining-text">{total - answered} question(s) remaining</p>
    </div>
  </div>
);

const AiAnalysisView = ({ sessionId, subStep, setSubStep, onBack, onNext, userProfile }) => {
  const dispatch = useAppDispatch();
  const [uploadedPhotos, setUploadedPhotos] = useState({
    P01: null,
    P02: null,
    P03: null,
    P04: null
  });
  const [isTriggering, setIsTriggering] = useState(false);
  const [skipPhotosForGeneration, setSkipPhotosForGeneration] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const [uploadProgress, setUploadProgress] = useState({
    P01: false,
    P02: false,
    P03: false,
    P04: false
  });

  const proceedToResults = () => {
    setSubStep('results');
  };

  const handleDeletePhoto = (key) => {
    setUploadedPhotos(prev => ({ ...prev, [key]: null }));
  };

  const handleUploadPhoto = async (key, file) => {
    if (file) {
      // Show local preview immediately
      const preview = URL.createObjectURL(file);
      setUploadedPhotos(prev => ({ ...prev, [key]: { file, preview } }));
      if (showValidationErrors) setShowValidationErrors(false);
    }
  };

  const handleTrigger = async (skip = false) => {
    if (!skip && !canAnalyze) {
      setShowValidationErrors(true);
      toast.error("Please upload all required photos before analysis.");
      return;
    }

    try {
      setIsTriggering(true);
      if (!sessionId) {
        toast.error('Session missing. Please complete the questionnaire again.');
        onBack();
        return;
      }

      // 1. Upload photos first if not skipping
      if (!skip) {
        const uploadPromises = Object.keys(uploadedPhotos).map(async (key) => {
          const photoData = uploadedPhotos[key];
          if (photoData && photoData.file) {
            try {
              setUploadProgress(prev => ({ ...prev, [key]: 'uploading' }));
              const response = await dispatch(uploadImageThunk({ sessionId, photoId: key, file: photoData.file })).unwrap();
              if (response.success) {
                setUploadProgress(prev => ({ ...prev, [key]: 'done' }));
              } else {
                setUploadProgress(prev => ({ ...prev, [key]: 'error' }));
                throw new Error(`Failed to upload ${key}`);
              }
            } catch (err) {
              setUploadProgress(prev => ({ ...prev, [key]: 'error' }));
              throw err;
            }
          }
        });

        await Promise.all(uploadPromises);
      }

      const statusResponse = await dispatch(checkSessionStatusThunk(sessionId)).unwrap();
      const currentStatus = String(
        statusResponse?.data?.status ||
        statusResponse?.status ||
        statusResponse?.sessionStatus ||
        statusResponse?.state ||
        ''
      ).toUpperCase();

      if (currentStatus === 'QUESTIONNAIRE_IN_PROGRESS') {
        const finalizeResponse = await dispatch(finalizeQuizThunk(sessionId)).unwrap();
        if (!isSuccessResponse(finalizeResponse?.success)) {
          toast.error('Please complete all questionnaire sections before starting analysis.');
          onBack();
          return;
        }
      }

      const response = await dispatch(triggerAnalysisThunk({ sessionId, skipPhotos: skip })).unwrap();
      if (!isSuccessResponse(response?.success)) {
        const backendMessage = response?.message || response?.error || 'Could not queue analysis yet. We will retry after verification.';
        if (/QUESTIONNAIRE_IN_PROGRESS/i.test(backendMessage)) {
          toast.error('Please complete all questionnaire sections before starting analysis.');
          onBack();
          return;
        }
        toast.warning(backendMessage);
        return;
      }

      // Move to paywall/results only after analysis queue succeeds.
      setSkipPhotosForGeneration(skip);
      proceedToResults();
    } catch (error) {
      console.error('Ready-signal trigger failed:', error);
      const backendMessage = error?.response?.data?.error || error?.response?.data?.message || '';
      if (/QUESTIONNAIRE_IN_PROGRESS/i.test(String(backendMessage))) {
        toast.error('Please complete all questionnaire sections before starting analysis.');
        onBack();
        return;
      }
      toast.warning('Could not queue analysis yet. We will retry after verification.');
    } finally {
      setIsTriggering(false);
    }
  };

  const requiredPhotoKeys = ['P01', 'P02'];
  const allPhotoKeys = ['P01', 'P02', 'P03', 'P04'];
  const totalRequired = requiredPhotoKeys.length;
  const countRequired = requiredPhotoKeys.map((key) => uploadedPhotos[key]).filter(Boolean).length;
  const totalUploaded = allPhotoKeys.map((key) => uploadedPhotos[key]).filter(Boolean).length;
  const canAnalyze = countRequired === totalRequired;
  const missingKeys = requiredPhotoKeys.filter(key => !uploadedPhotos[key]);

  if (subStep === 'upload') {
    return (
      <div className="ai-analysis-container">
        <header className="prep-header">
          <div className="header-left-group">
            <div className="back-btn" onClick={() => setSubStep('intro')}>
              <FaChevronLeft /> BACK
            </div>
            <div className="header-divider"></div>
            <div className="prep-logo">
              <img src="/reportlogo.png" alt="HairSnCare" />
            </div>
          </div>
          <div className="header-right">AI Analysis</div>
        </header>

        <div className="ai-progress-status">
          <div className="ai-label-group">
            <span className="ai-main-label">AI PHOTO ANALYSIS</span>
            <span className="ai-optional-tag">Step 2 of 3</span>
          </div>
          <div className="ai-progress-track">
            <div className="ai-progress-fill" style={{ width: '66%' }}></div>
          </div>
        </div>

        <main className="ai-content-main">
          <div className="ai-upload-hero-section">
            <div className="hero-indicator-yellow"></div>
            <div className="hero-text-block">
              <h1 className="upload-title-main">Upload Scalp Photos</h1>
              <p className="upload-subtitle-main">
                Our AI analyzes scalp photos to detect hair thinning patterns and improve your diagnostic accuracy.
              </p>
            </div>
          </div>

          <div className="ai-upload-grid-cards">
            <UploadCardMain
              label="Front Hairline View"
              status="Required"
              icon={<FrontViewIcon />}
              previewUrl={uploadedPhotos.P01?.preview}
              onDelete={() => handleDeletePhoto('P01')}
              onUpload={(file) => handleUploadPhoto('P01', file)}
              showError={showValidationErrors && !uploadedPhotos.P01}
            />
            <UploadCardMain
              label="Top / Crown View"
              status="Required"
              icon={<TopViewIcon />}
              previewUrl={uploadedPhotos.P02?.preview}
              onDelete={() => handleDeletePhoto('P02')}
              onUpload={(file) => handleUploadPhoto('P02', file)}
              showError={showValidationErrors && !uploadedPhotos.P02}
            />
            <UploadCardMain
              label="Left Side Profile"
              status="Optional"
              icon={<SideViewLeftIcon />}
              previewUrl={uploadedPhotos.P03?.preview}
              onDelete={() => handleDeletePhoto('P03')}
              onUpload={(file) => handleUploadPhoto('P03', file)}
            />
            <UploadCardMain
              label="Right Side Profile"
              status="Optional"
              icon={<SideViewRightIcon />}
              previewUrl={uploadedPhotos.P04?.preview}
              onDelete={() => handleDeletePhoto('P04')}
              onUpload={(file) => handleUploadPhoto('P04', file)}
            />
          </div>

          {showValidationErrors && missingKeys.length > 0 && (
            <div className="ai-validation-error-banner">
              <FaInfoCircle />
              <span>Please upload the required photos highlight in red to continue.</span>
            </div>
          )}

          <div className="ai-requirements-section">
            <div className="req-header-row">
              <TipsBulbIcon />
              <h3 className="req-title">Tips for Best Results</h3>
            </div>
            <ul className="req-listing yellow-dots">
              <li>Use natural lighting from above</li>
              <li>Keep hair parted to reveal scalp</li>
              <li>Avoid hats or shadows</li>
              <li>Hold camera steady</li>
            </ul>
          </div>

          <div className="ai-privacy-banner-box">
            <SecureLockIcon />
            <p>Your photos are processed securely and are <strong>never stored after analysis.</strong></p>
          </div>

          {totalUploaded > 0 && (
            <div className="ai-ready-status-banner">
              <FaCheckCircle style={{ color: '#F4C430' }} />
              <span><strong>{totalUploaded} photo{totalUploaded > 1 ? 's' : ''}</strong> ready for analysis</span>
            </div>
          )}

          <div className="ai-action-footer">
            <button
              className={`analyze-action-btn ${(canAnalyze || isTriggering) ? 'active' : ''}`}
              onClick={() => handleTrigger(false)}
              disabled={isTriggering}
            >
              {isTriggering ? 'Analyzing...' : 'Analyze Photos'} <SparklesIcon />
            </button>
            <button className="skip-btn-lg" onClick={() => handleTrigger(true)} disabled={isTriggering}>
              Skip Photo Analysis
            </button>
            <p className="ai-final-note">Photo analysis improves diagnostic accuracy by up to 34%.</p>
          </div>
        </main>
      </div>
    );
  }

  if (subStep === 'processing') {
    return (
      <ProcessingView
        sessionId={sessionId}
        onBack={() => setSubStep('upload')}
        onComplete={proceedToResults}
      />
    );
  }

  if (subStep === 'results') {
    return (
      <ResultsView
        sessionId={sessionId}
        onBack={() => setSubStep('upload')}
        onNext={onNext}
        skipPhotosForGeneration={skipPhotosForGeneration}
        userProfile={userProfile}
      />
    );
  }

  return (
    <div className="ai-analysis-container">
      <header className="prep-header">
        <div className="header-left-group">
          <div className="back-btn" onClick={onBack}>
            <FaChevronLeft /> BACK
          </div>
          <div className="header-divider"></div>
          <div className="prep-logo">
            <img src="/reportlogo.png" alt="HairSnCare" />
          </div>
        </div>
        <div className="header-right">AI Analysis</div>
      </header>

      <div className="ai-progress-status">
        <div className="ai-label-group">
          <span className="ai-main-label">AI PHOTO ANALYSIS</span>
          <span className="ai-optional-tag">Optional Step</span>
        </div>
        <div className="ai-progress-track">
          <div className="ai-progress-fill" style={{ width: '40%' }}></div>
        </div>
      </div>

      <main className="ai-content-main">
        <div className="ai-hero-card">
          <div className="ai-hero-inner">
            <img src="/aiphotoanalytics.png" alt="AI Analysis Scan" />
          </div>
        </div>

        <h1 className="ai-title-primary">Improve Your Diagnosis with AI Photo Analysis</h1>
        <p className="ai-subtitle-primary">
          Upload scalp photos so our AI can analyze hair density, hairline shape, and scalp health more accurately.
        </p>

        <div className="ai-accuracy-badge-box">
          <div className="accuracy-icon-box">
            <svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.5 4C9.86 4 10.1933 4.09 10.5 4.27C10.8067 4.45 11.05 4.69333 11.23 5C11.41 5.30667 11.5 5.64 11.5 6V12.82C10.66 12.18 9.54667 11.7467 8.16 11.52L7.84 13.48C9.13333 13.7067 10.0667 14.13 10.64 14.75C11.2133 15.37 11.5 16.2867 11.5 17.5C11.5 17.9533 11.3867 18.37 11.16 18.75C10.9333 19.13 10.63 19.4333 10.25 19.66C9.87 19.8867 9.45333 20 9 20C8.54667 20 8.13 19.8867 7.75 19.66C7.37 19.4333 7.06667 19.13 6.84 18.75C6.61333 18.37 6.5 17.9533 6.5 17.5V17.14C6.95333 17.3 7.4 17.4133 7.84 17.48L8.16 15.52C7.49333 15.4 6.74667 15.1467 5.92 14.76C5.49333 14.56 5.15 14.2567 4.89 13.85C4.63 13.4433 4.5 12.9933 4.5 12.5C4.5 11.7 4.68667 11.0433 5.06 10.53C5.43333 10.0167 5.99333 9.66667 6.74 9.48L7.5 9.28V6C7.5 5.64 7.59 5.30667 7.77 5C7.95 4.69333 8.19333 4.45 8.5 4.27C8.80667 4.09 9.14 4 9.5 4ZM12.5 3.36C12.1267 2.93333 11.68 2.6 11.16 2.36C10.64 2.12 10.0867 2 9.5 2C8.78 2 8.11333 2.18 7.5 2.54C6.88667 2.9 6.4 3.38667 6.04 4C5.68 4.61333 5.5 5.28 5.5 6V7.78C4.63333 8.12667 3.94667 8.64667 3.44 9.34C2.81333 10.2067 2.5 11.26 2.5 12.5C2.5 13.2733 2.68 13.9867 3.04 14.64C3.4 15.2933 3.88667 15.8267 4.5 16.24V17.5C4.5 18.3133 4.70333 19.0633 5.11 19.75C5.51667 20.4367 6.06333 20.9833 6.75 21.39C7.43667 21.7967 8.18667 22 9 22C9.69333 22 10.3433 21.85 10.95 21.55C11.5567 21.25 12.0733 20.84 12.5 20.32C12.9267 20.84 13.4433 21.25 14.05 21.55C14.6567 21.85 15.3067 22 16 22C16.8133 22 17.5633 21.7967 18.25 21.39C18.9367 20.9833 19.4833 20.4367 19.89 19.75C20.2967 19.0633 20.5 18.3133 20.5 17.5V16.24C21.1133 15.8267 21.6 15.2933 21.96 14.64C22.32 13.9867 22.5 13.2733 22.5 12.5C22.5 11.26 22.1867 10.2067 21.56 9.34C21.0533 8.64667 20.3667 8.12667 19.5 7.78V6C19.5 5.28 19.32 4.61333 18.96 4C18.6 3.38667 18.1133 2.9 17.5 2.54C16.8867 2.18 16.22 2 15.5 2C14.9133 2 14.36 2.12 13.84 2.36C13.32 2.6 12.8733 2.93333 12.5 3.36ZM18.5 17.14V17.5C18.5 17.9533 18.3867 18.37 18.16 18.75C17.9333 19.13 17.63 19.4333 17.25 19.66C16.87 19.8867 16.4533 20 16 20C15.5467 20 15.13 19.8867 14.75 19.66C14.37 19.4333 14.0667 19.13 13.84 18.75C13.6133 18.37 13.5 17.9533 13.5 17.5C13.5 16.2867 13.7867 15.37 14.36 14.75C14.9333 14.13 15.8667 13.7067 17.16 13.48L16.84 11.52C15.4533 11.7467 14.34 12.18 13.5 12.82V6C13.5 5.64 13.59 5.30667 13.77 5C13.95 4.69333 14.1933 4.45 14.5 4.27C14.8067 4.09 15.14 4 15.5 4C15.86 4 16.1933 4.09 16.5 4.27C16.8067 4.45 17.05 4.69333 17.23 5C17.41 5.30667 17.5 5.64 17.5 6V9.28L18.26 9.48C19.0067 9.66667 19.5667 10.0167 19.94 10.53C20.3133 11.0433 20.5 11.7 20.5 12.5C20.5 12.9933 20.37 13.4433 20.11 13.85C19.85 14.2567 19.5067 14.56 19.08 14.76C18.2533 15.1467 17.5067 15.4 16.84 15.52L17.16 17.48C17.6 17.4133 18.0467 17.3 18.5 17.14Z" fill="#021220" />
            </svg>

          </div>
          <div className="accuracy-text-box">
            <h3>Photo analysis improves diagnostic accuracy by <span>up to 34%</span></h3>
            <p>AI-powered visual assessment enhances report precision</p>
          </div>
        </div>

        <div className="analysis-features-section">
          <div className="section-header">
            <div className="section-indicator"></div>
            <h2 className="section-title">What the AI Will Analyze</h2>
          </div>

          <div className="analyze-grid">
            <div className="analyze-item-card">
              <div className="analyze-icon-box">
                <TargetIconSmall />
              </div>
              <span>Hairline recession detection</span>
            </div>
            <div className="analyze-item-card">
              <div className="analyze-icon-box">
                <ClockIconSmall />
              </div>
              <span>Crown thinning analysis</span>
            </div>
            <div className="analyze-item-card">
              <div className="analyze-icon-box">
                <HeartIconSmall />
              </div>
              <span>Scalp health indicators</span>
            </div>
            <div className="analyze-item-card">
              <div className="analyze-icon-box">
                <GridIconSmall />
              </div>
              <span>Hair density estimation</span>
            </div>
          </div>
        </div>

        <div className="ai-requirements-section">
          <div className="req-header-row">
            <PhotoReqIcon />
            <h3 className="req-title">Photo Requirements</h3>
          </div>
          <ul className="req-listing">
            <li>Clear lighting from above</li>
            <li>Hair parted to show scalp</li>
            <li>No hats or accessories</li>
            <li>Multiple angles recommended</li>
          </ul>
        </div>

        <div className="ai-privacy-banner-box">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.5998 8.33337H16.3998C16.6238 8.33337 16.8131 8.41393 16.9678 8.57504C17.1225 8.73615 17.1998 8.93337 17.1998 9.16671V17.5C17.1998 17.7334 17.1225 17.9306 16.9678 18.0917C16.8131 18.2528 16.6238 18.3334 16.3998 18.3334H3.5998C3.3758 18.3334 3.18647 18.2528 3.0318 18.0917C2.87714 17.9306 2.7998 17.7334 2.7998 17.5V9.16671C2.7998 8.93337 2.87714 8.73615 3.0318 8.57504C3.18647 8.41393 3.3758 8.33337 3.5998 8.33337H4.3998V7.50004C4.3998 6.44449 4.6558 5.46115 5.1678 4.55004C5.65847 3.67226 6.32514 2.97782 7.1678 2.46671C8.04247 1.93337 8.98647 1.66671 9.9998 1.66671C11.0131 1.66671 11.9571 1.93337 12.8318 2.46671C13.6745 2.97782 14.3411 3.67226 14.8318 4.55004C15.3438 5.46115 15.5998 6.44449 15.5998 7.50004V8.33337ZM4.3998 10V16.6667H15.5998V10H4.3998ZM9.1998 11.6667H10.7998V15H9.1998V11.6667ZM13.9998 8.33337V7.50004C13.9998 6.74449 13.8211 6.04726 13.4638 5.40837C13.1065 4.76949 12.6211 4.26393 12.0078 3.89171C11.3945 3.51949 10.7251 3.33337 9.9998 3.33337C9.27447 3.33337 8.60514 3.51949 7.9918 3.89171C7.37847 4.26393 6.89314 4.76949 6.5358 5.40837C6.17847 6.04726 5.9998 6.74449 5.9998 7.50004V8.33337H13.9998Z" fill="#0ED7B5" />
          </svg>

          <p>Your photos are processed securely and are <strong>never stored after analysis.</strong></p>
        </div>

        <div className="ai-action-footer">
          <button className="upload-btn-lg" onClick={() => setSubStep('upload')}>
            Upload Scalp Photos <UploadIcon />
          </button>
          <button
            className="skip-btn-lg"
            onClick={() => handleTrigger(true)}
            disabled={isTriggering}
          >
            {isTriggering ? 'Skipping...' : 'Skip Photo Analysis'}
          </button>
          <p className="ai-final-note">This information helps improve the accuracy of your diagnosis.</p>
        </div>
      </main>
    </div>
  );
};

/* Icons */
const BrainIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="#020617" />
    <path d="M9.5 9.5C9.5 8.12 10.62 7 12 7C13.38 7 14.5 8.12 14.5 9.5C14.5 10.88 13.38 12 12 12C10.62 12 9.5 10.88 9.5 9.5Z" fill="#020617" />
  </svg>
);

/* Icons */
const TargetIconSmall = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.8002 0.833292V3.38329C11.7495 3.50551 12.6269 3.83329 13.4322 4.36662C14.2375 4.89996 14.8962 5.58607 15.4082 6.42496C15.9202 7.26385 16.2349 8.17774 16.3522 9.16663H18.8002V10.8333H16.3522C16.2349 11.8222 15.9202 12.7361 15.4082 13.575C14.8962 14.4138 14.2375 15.1 13.4322 15.6333C12.6269 16.1666 11.7495 16.4944 10.8002 16.6166V19.1666H9.2002V16.6166C8.25086 16.4944 7.37353 16.1666 6.5682 15.6333C5.76286 15.1 5.1042 14.4138 4.5922 13.575C4.0802 12.7361 3.76553 11.8222 3.6482 10.8333H1.2002V9.16663H3.6482C3.76553 8.17774 4.0802 7.26385 4.5922 6.42496C5.1042 5.58607 5.76286 4.89996 6.5682 4.36662C7.37353 3.83329 8.25086 3.50551 9.2002 3.38329V0.833292H10.8002ZM10.0002 4.99996C9.1362 4.99996 8.33086 5.22774 7.5842 5.68329C6.85886 6.12774 6.28286 6.72774 5.8562 7.48329C5.41886 8.26107 5.2002 9.09996 5.2002 9.99996C5.2002 10.9 5.41886 11.7388 5.8562 12.5166C6.28286 13.2722 6.85886 13.8722 7.5842 14.3166C8.33086 14.7722 9.1362 15 10.0002 15C10.8642 15 11.6695 14.7722 12.4162 14.3166C13.1415 13.8722 13.7175 13.2722 14.1442 12.5166C14.5815 11.7388 14.8002 10.9 14.8002 9.99996C14.8002 9.09996 14.5815 8.26107 14.1442 7.48329C13.7175 6.72774 13.1415 6.12774 12.4162 5.68329C11.6695 5.22774 10.8642 4.99996 10.0002 4.99996ZM10.0002 8.33329C10.2882 8.33329 10.5549 8.40829 10.8002 8.55829C11.0455 8.70829 11.2402 8.91107 11.3842 9.16663C11.5282 9.42218 11.6002 9.69996 11.6002 9.99996C11.6002 10.3 11.5282 10.5777 11.3842 10.8333C11.2402 11.0888 11.0455 11.2916 10.8002 11.4416C10.5549 11.5916 10.2882 11.6666 10.0002 11.6666C9.7122 11.6666 9.44553 11.5916 9.2002 11.4416C8.95486 11.2916 8.7602 11.0888 8.6162 10.8333C8.4722 10.5777 8.4002 10.3 8.4002 9.99996C8.4002 9.69996 8.4722 9.42218 8.6162 9.16663C8.7602 8.91107 8.95486 8.70829 9.2002 8.55829C9.44553 8.40829 9.7122 8.33329 10.0002 8.33329Z" fill="#00E5FF" />
  </svg>
);

const ClockIconSmall = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.944 3.55004L11.136 10L10 11.1834L4.944 5.91671C4.51733 6.48337 4.18667 7.11115 3.952 7.80004C3.71733 8.51115 3.6 9.24449 3.6 10C3.6 11.2112 3.89333 12.3334 4.48 13.3667C5.04533 14.3667 5.808 15.1612 6.768 15.75C7.76 16.3612 8.83733 16.6667 10 16.6667C11.1627 16.6667 12.24 16.3612 13.232 15.75C14.192 15.1612 14.9547 14.3667 15.52 13.3667C16.1067 12.3334 16.4 11.2112 16.4 10C16.4 8.78893 16.1067 7.66671 15.52 6.63338C14.9547 5.63338 14.192 4.83893 13.232 4.25004C12.24 3.63893 11.1627 3.33337 10 3.33337C9.28533 3.33337 8.58667 3.4556 7.904 3.70004L6.672 2.41671C7.728 1.91671 8.83733 1.66671 10 1.66671C11.088 1.66671 12.128 1.88338 13.12 2.31671C14.0693 2.73893 14.9147 3.33615 15.656 4.10837C16.3973 4.8806 16.9707 5.76115 17.376 6.75004C17.792 7.78337 18 8.86671 18 10C18 11.1334 17.792 12.2167 17.376 13.25C16.9707 14.2389 16.3973 15.1195 15.656 15.8917C14.9147 16.6639 14.0693 17.2612 13.12 17.6834C12.128 18.1167 11.088 18.3334 10 18.3334C8.912 18.3334 7.872 18.1167 6.88 17.6834C5.93067 17.2612 5.08533 16.6639 4.344 15.8917C3.60267 15.1195 3.02933 14.2389 2.624 13.25C2.208 12.2167 2 11.1334 2 10C2 8.72226 2.26667 7.51115 2.8 6.36671C3.312 5.26671 4.02667 4.32782 4.944 3.55004Z" fill="#00E5FF" />
  </svg>
);

const HeartIconSmall = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14.0001 2.28328C14.8001 2.28328 15.5361 2.49995 16.2081 2.93328C16.8801 3.36662 17.4081 3.95551 17.7921 4.69995C18.1974 5.47773 18.4001 6.33884 18.4001 7.28328C18.4001 8.57217 18.1121 9.81106 17.5361 11C17.0454 12.0111 16.3468 12.9833 15.4401 13.9166C14.7361 14.65 13.8988 15.3666 12.9281 16.0666C12.3841 16.4555 11.6694 16.9222 10.7841 17.4666L10.4001 17.7L10.0161 17.4666C9.0881 16.9 8.34143 16.4111 7.7761 16C6.76276 15.2666 5.89343 14.5111 5.1681 13.7333C4.25076 12.7333 3.55743 11.7 3.0881 10.6333L1.6001 10.6166V8.94995L2.5761 8.96662C2.45876 8.41106 2.4001 7.84995 2.4001 7.28328C2.4001 6.33884 2.60276 5.47773 3.0081 4.69995C3.3921 3.95551 3.9201 3.36662 4.5921 2.93328C5.2641 2.49995 6.0001 2.28328 6.8001 2.28328C7.49343 2.28328 8.18143 2.46106 8.8641 2.81662C9.4401 3.10551 9.9521 3.48328 10.4001 3.94995C10.8481 3.48328 11.3601 3.10551 11.9361 2.81662C12.6188 2.46106 13.3068 2.28328 14.0001 2.28328ZM14.0001 3.94995C13.5734 3.94995 13.1414 4.05828 12.7041 4.27495C12.2668 4.49162 11.8774 4.77773 11.5361 5.13328L10.4001 6.31662L9.2641 5.13328C8.92276 4.77773 8.53343 4.49162 8.0961 4.27495C7.65876 4.05828 7.22676 3.94995 6.8001 3.94995C6.2881 3.94995 5.81876 4.09439 5.3921 4.38328C4.96543 4.67217 4.62676 5.0694 4.3761 5.57495C4.12543 6.08051 4.0001 6.65551 4.0001 7.29995C4.0001 7.85551 4.06943 8.41106 4.2081 8.96662L5.9521 8.94995L7.6001 6.08328L10.0001 10.25L10.7521 8.94995H14.4001V10.6166H11.6481L10.0001 13.5L7.6001 9.33328L6.8481 10.6166L4.8801 10.6333C5.49876 11.7444 6.44276 12.8277 7.7121 13.8833C8.27743 14.35 8.92276 14.8222 9.6481 15.3C9.8721 15.4444 10.1228 15.6 10.4001 15.7666C10.6774 15.6 10.9281 15.4444 11.1521 15.3C11.8774 14.8222 12.5228 14.35 13.0881 13.8833C14.3041 12.8722 15.2214 11.8333 15.8401 10.7666C16.4801 9.65551 16.8001 8.49995 16.8001 7.29995C16.8001 6.65551 16.6774 6.07773 16.4321 5.56662C16.1868 5.05551 15.8508 4.66106 15.4241 4.38328C14.9974 4.10551 14.5228 3.96106 14.0001 3.94995Z" fill="#00E5FF" />
  </svg>
);

const GridIconSmall = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.5998 8.33333H8.3998V11.6667H11.5998V8.33333ZM13.1998 8.33333V11.6667H15.5998V8.33333H13.1998ZM11.5998 15.8333V13.3333H8.3998V15.8333H11.5998ZM13.1998 15.8333H15.5998V13.3333H13.1998V15.8333ZM11.5998 4.16667H8.3998V6.66667H11.5998V4.16667ZM13.1998 4.16667V6.66667H15.5998V4.16667H13.1998ZM6.7998 8.33333H4.3998V11.6667H6.7998V8.33333ZM6.7998 15.8333V13.3333H4.3998V15.8333H6.7998ZM6.7998 4.16667H4.3998V6.66667H6.7998V4.16667ZM3.5998 2.5H16.3998C16.6238 2.5 16.8131 2.58055 16.9678 2.74167C17.1225 2.90278 17.1998 3.1 17.1998 3.33333V16.6667C17.1998 16.9 17.1225 17.0972 16.9678 17.2583C16.8131 17.4194 16.6238 17.5 16.3998 17.5H3.5998C3.3758 17.5 3.18647 17.4194 3.0318 17.2583C2.87714 17.0972 2.7998 16.9 2.7998 16.6667V3.33333C2.7998 3.1 2.87714 2.90278 3.0318 2.74167C3.18647 2.58055 3.3758 2.5 3.5998 2.5Z" fill="#00E5FF" />
  </svg>
);

const PhotoReqIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 18.3334C8.912 18.3334 7.872 18.1167 6.88 17.6834C5.93067 17.2612 5.08533 16.6639 4.344 15.8917C3.60267 15.1195 3.02933 14.2389 2.624 13.25C2.208 12.2167 2 11.1334 2 10C2 8.86671 2.208 7.78337 2.624 6.75004C3.02933 5.76115 3.60267 4.8806 4.344 4.10837C5.08533 3.33615 5.93067 2.73893 6.88 2.31671C7.872 1.88338 8.912 1.66671 10 1.66671C11.088 1.66671 12.128 1.88338 13.12 2.31671C14.0693 2.73893 14.9147 3.33615 15.656 4.10837C16.3973 4.8806 16.9707 5.76115 15.656 15.8917C14.9147 16.6639 14.0693 17.2612 13.12 17.6834C12.128 18.1167 11.088 18.3334 10 18.3334ZM10 16.6667C11.1627 16.6667 12.24 16.3612 13.232 15.75C14.192 15.1612 14.9547 14.3667 15.52 13.3667C16.1067 12.3334 16.4 11.2112 16.4 10C16.4 8.78893 16.1067 7.66671 15.52 6.63338C14.9547 5.63338 14.192 4.83893 13.232 4.25004C12.24 3.63893 11.1627 3.33337 10 3.33337C8.83733 3.33337 7.76 3.63893 6.768 4.25004C5.808 4.83893 5.04533 5.63338 4.48 6.63338C3.89333 7.66671 3.6 8.78893 3.6 10C3.6 11.2112 3.89333 12.3334 4.48 13.3667C5.04533 14.3667 5.808 15.1612 6.768 15.75C7.76 16.3612 8.83733 16.6667 10 16.6667ZM9.2 13.3334L5.808 9.80004L6.944 8.61671L9.2 10.9834L13.728 6.26671L14.864 7.43337L9.2 13.3334Z" fill="#0ED7B5" />
  </svg>
);

const UploadIcon = () => (
  <svg width="19" height="18" viewBox="0 0 19 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.74635 3.75L6.2451 5.25H3.37771V14.25H15.3877V5.25H12.5203L11.0191 3.75H7.74635ZM7.13084 2.25H11.6346L13.1358 3.75H16.1383C16.3485 3.75 16.5262 3.8225 16.6713 3.9675C16.8164 4.1125 16.889 4.29 16.889 4.5V15C16.889 15.21 16.8164 15.3875 16.6713 15.5325C16.5262 15.6775 16.3485 15.75 16.1383 15.75H2.62709C2.41691 15.75 2.23927 15.6775 2.09415 15.5325C1.94903 15.3875 1.87646 15.21 1.87646 15V4.5C1.87646 4.29 1.94903 4.1125 2.09415 3.9675C2.23927 3.8225 2.41691 3.75 2.62709 3.75H5.62959L7.13084 2.25ZM9.38271 13.5C8.63209 13.5 7.94151 13.315 7.31099 12.945C6.68046 12.575 6.18005 12.075 5.80974 11.445C5.43943 10.815 5.25428 10.125 5.25428 9.375C5.25428 8.625 5.43943 7.935 5.80974 7.305C6.18005 6.675 6.68046 6.175 7.31099 5.805C7.94151 5.435 8.63209 5.25 9.38271 5.25C10.1333 5.25 10.8239 5.435 11.4544 5.805C12.085 6.175 12.5854 6.675 12.9557 7.305C13.326 7.935 13.5112 8.625 13.5112 9.375C13.5112 10.125 13.326 10.815 12.9557 11.445C12.5854 12.075 12.085 12.575 11.4544 12.945C10.8239 13.315 10.1333 13.5 9.38271 13.5ZM9.38271 12C9.86311 12 10.3035 11.8825 10.7038 11.6475C11.1041 11.4125 11.4219 11.095 11.6571 10.695C11.8923 10.295 12.0099 9.855 12.0099 9.375C12.0099 8.895 11.8923 8.455 11.6571 8.055C11.4219 7.655 11.1041 7.3375 10.7038 7.1025C10.3035 6.8675 9.86311 6.75 9.38271 6.75C8.90231 6.75 8.46195 6.8675 8.06161 7.1025C7.66128 7.3375 7.34352 7.655 7.10832 8.055C6.87313 8.455 6.75553 8.895 6.75553 9.375C6.75553 9.855 6.87313 10.295 7.10832 10.695C7.34352 11.095 7.66128 11.4125 8.06161 11.6475C8.46195 11.8825 8.90231 12 9.38271 12Z" fill="currentColor" />
  </svg>
);

const ProcessingView = ({ sessionId, onBack, onComplete }) => {
  const dispatch = useAppDispatch();
  const [progress, setProgress] = useState(2);
  const [activeStep, setActiveStep] = useState(0);
  const [status, setStatus] = useState('INIT');

  useEffect(() => {
    let pollInterval;

    const checkStatus = async () => {
      try {
        const response = await dispatch(checkSessionStatusThunk(sessionId)).unwrap();
        if (response.success) {
          const currentStatus = response.data.status;
          setStatus(currentStatus);

          // Map status to progress for visual feel
          if (currentStatus === 'INIT' || currentStatus === 'REPORT_QUEUED' || currentStatus === 'UPLOADED') {
            setProgress(prev => Math.max(prev, 15));
          }
          if (currentStatus === 'PROCESSING' || currentStatus === 'ANALYZING') {
            setProgress(prev => Math.max(prev, 45));
          }
          if (currentStatus === 'ANALYSIS_COMPLETE' || currentStatus === 'COMPLETED') {
            setProgress(100);
            clearInterval(pollInterval);
            setTimeout(() => onComplete(), 1500);
          }
        }
      } catch (error) {
        console.error("Status check failed:", error);
      }
    };

    // Initial check
    checkStatus();

    // Poll every 8 seconds as per user request
    pollInterval = setInterval(checkStatus, 8000);

    return () => clearInterval(pollInterval);
  }, [sessionId, onComplete, dispatch]);

  useEffect(() => {
    // Fake granular progress increments to keep the bar moving smoothly
    // Using a faster interval (500ms) for better visual feedback
    const fakeTimer = setInterval(() => {
      setProgress(prev => {
        // Stop if already completed
        if (status === 'ANALYSIS_COMPLETE' || status === 'COMPLETED') return prev;

        // Progress while waiting for backend
        if (prev < 96) {
          // Early stage movement is faster (1.2% per 0.5s = 2.4% per sec)
          // Later stage movement is slower (0.4% per 0.5s = 0.8% per sec)
          const increment = prev < 40 ? 1.2 : 0.4;
          return prev + increment;
        }
        return prev;
      });
    }, 500);
    return () => clearInterval(fakeTimer);
  }, [status]);

  useEffect(() => {
    setActiveStep(Math.min(Math.floor(progress / 20), 4));
  }, [progress]);

  const steps = [
    "Image quality verification",
    "Hairline pattern detection",
    "Scalp density analysis",
    "Miniaturization detection",
    "Scalp condition analysis"
  ];

  return (
    <div className="ai-analysis-container">
      <header className="prep-header">
        <div className="header-left-group">
          <div className="back-btn" onClick={onBack}>
            <FaChevronLeft /> BACK
          </div>
          <div className="header-divider"></div>
          <div className="prep-logo">
            <img src="/reportlogo.png" alt="HairSnCare" />
          </div>
        </div>
        <div className="header-right">AI Diagnostic Processing</div>
      </header>

      <main className="ai-content-main proc-content">
        <div className="ai-proc-hero-card">
          <div className="scan-animation-box">
            <img src="/aiphotoanalytics.png" alt="AI Scan" className="scan-base-img" />
            <div className="scan-line-v"></div>
          </div>
          <div className="proc-progress-container">
            <div className="proc-progress-track">
              <div className="proc-progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="proc-percent">{Math.floor(progress)}%</span>
          </div>
        </div>

        <div className="proc-text-center">
          <h1 className="proc-title">Analyzing Your Scalp Images</h1>
          <p className="proc-subtitle">
            Our AI is examining hair density, hairline structure, and scalp health indicators.
          </p>
        </div>

        <div className="proc-checklist-card">
          {steps.map((step, idx) => {
            const isCompleted = idx < activeStep;
            const isActive = idx === activeStep;
            return (
              <div key={idx} className={`proc-check-item ${isCompleted ? 'completed' : isActive ? 'active' : ''}`}>
                <div className="item-status-icon">
                  {isCompleted ? <StatusCompletedIcon /> : isActive ? <StatusActiveIcon /> : <StatusPendingIcon />}
                </div>
                <span className="item-label">{step}</span>
              </div>
            );
          })}
        </div>

        <div className="proc-engine-info-card">
          <div className="engine-icon-v">
            <AiEngineIcon />
          </div>
          <div className="engine-text-v">
            <h4>Advanced Hair Intelligence Engine</h4>
            <p>Our system analyzes over 12 visual markers including scalp visibility, follicle density, and hairline recession.</p>
          </div>
        </div>

        <div className="proc-time-notice">
          <ProcClockIcon />
          <p>AI analysis usually takes about <strong>10–12 seconds.</strong></p>
        </div>

        <div className="proc-warning-notice">
          <ProcInfoIcon />
          <p>Please keep this page open while your analysis completes.</p>
        </div>

      </main>
    </div>
  );
};

const OtpModal = ({ isOpen, onClose, onVerify, phone, isVerifying = false, otpLength = 4, errorMessage = '', onClearError }) => {
  const [otp, setOtp] = React.useState(Array(otpLength).fill(''));
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = React.useRef([]);

  useEffect(() => {
    let interval;
    if (isOpen && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isOpen, timer]);

  const handleResend = () => {
    if (!canResend) return;
    // Logic to trigger backend resend would go here
    if (typeof onClearError === 'function') onClearError();
    setTimer(60);
    setCanResend(false);
    setOtp(Array(otpLength).fill(''));
    inputRefs.current[0]?.focus();
  };

  useEffect(() => {
    setOtp(Array(otpLength).fill(''));
  }, [otpLength, isOpen]);

  if (!isOpen) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `0${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleChange = (element, index) => {
    if (!/^\d?$/.test(element.value)) return false;
    if (typeof onClearError === 'function') onClearError();
    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    if (element.value !== "" && index < otpLength - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const isFilled = otp.every(v => v !== "");

  return (
    <div className="otp-overlay">
      <div className="otp-modal-card">
        <div className="otp-modal-header">
          <div className="otp-header-left">
            <div className="otp-header-shield">
              <svg width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.4141 0.833292L17.2624 2.34996C17.4513 2.3944 17.6068 2.4944 17.729 2.64996C17.8512 2.80551 17.9123 2.97774 17.9123 3.16663V11.4833C17.9123 12.3277 17.7151 13.1166 17.3207 13.85C16.9264 14.5833 16.3793 15.1833 15.6795 15.65L10.4141 19.1666L5.14879 15.65C4.44897 15.1833 3.90188 14.5833 3.50753 13.85C3.11319 13.1166 2.91602 12.3277 2.91602 11.4833V3.16663C2.91602 2.97774 2.97711 2.80551 3.0993 2.64996C3.22149 2.4944 3.37701 2.3944 3.56585 2.34996L10.4141 0.833292ZM10.4141 2.53329L4.58227 3.83329V11.4833C4.58227 12.05 4.71279 12.5777 4.97383 13.0666C5.23488 13.5555 5.59868 13.9555 6.06523 14.2666L10.4141 17.1666L14.7631 14.2666C15.2296 13.9555 15.5934 13.5555 15.8544 13.0666C16.1155 12.5777 16.246 12.05 16.246 11.4833V3.83329L10.4141 2.53329ZM14.1299 6.84996L15.2963 8.03329L9.99758 13.3333L6.46513 9.79996L7.64817 8.61663L9.99758 10.9833L14.1299 6.84996Z" fill="#0ED7B5" opacity="0.6" />
              </svg>
            </div>
            <div className="otp-header-text">
              <h4>Verify Your Number</h4>
              <span>OTP sent to +91 {phone || '1234567890'}</span>
            </div>
          </div>
          <button className="otp-close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.4 14L0 12.6L5.6 7L0 1.4L1.4 0L7 5.6L12.6 0L14 1.4L8.4 7L14 12.6L12.6 14L7 8.4L1.4 14Z" fill="#3A5A80" />
            </svg>
          </button>
        </div>

        <div className="otp-body">
          <p className="otp-instruct">Enter the 4-digit code sent to +91 {phone || '1234567890'}</p>
          <div className="otp-inputs-row">
            {otp.map((data, index) => (
              <input
                key={index}
                type="text"
                maxLength="1"
                ref={el => inputRefs.current[index] = el}
                value={data}
                onChange={e => handleChange(e.target, index)}
                onKeyDown={e => handleKeyDown(e, index)}
                className={`otp-digit-input ${data ? 'is-filled' : ''}`}
                onFocus={(e) => e.target.select()}
              />
            ))}
          </div>

          {!!errorMessage && (
            <p className="otp-error-text" style={{ color: '#EF4444', marginTop: '10px', textAlign: 'center', fontSize: '13px' }}>
              {errorMessage}
            </p>
          )}

          <button
            className={`otp-verify-btn ${isFilled ? 'active' : ''}`}
            onClick={() => isFilled && onVerify(otp.join(''))}
            disabled={!isFilled || isVerifying}
          >
            <div className="btn-l-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.00008 1.58342L12.7934 2.64508C12.9255 2.67619 13.0344 2.74619 13.1199 2.85508C13.2054 2.96397 13.2482 3.08453 13.2482 3.21675V9.03841C13.2482 9.62953 13.1102 10.1817 12.8342 10.6951C12.5582 11.2084 12.1753 11.6284 11.6854 11.9551L8.00008 14.4167L4.31473 11.9551C3.8249 11.6284 3.44198 11.2084 3.16597 10.6951C2.88996 10.1817 2.75195 9.62953 2.75195 9.03841V3.21675C2.75195 3.08453 2.79472 2.96397 2.88024 2.85508C2.96577 2.74619 3.07462 2.67619 3.20679 2.64508L8.00008 1.58342ZM8.00008 2.77341L3.9182 3.68341V9.03841C3.9182 9.43508 4.00956 9.80453 4.19227 10.1467C4.37498 10.489 4.62962 10.769 4.95617 10.9867L8.00008 13.0167L11.044 10.9867C11.3705 10.769 11.6252 10.489 11.8079 10.1467C11.9906 9.80453 12.082 9.43508 12.082 9.03841V3.68341L8.00008 2.77341ZM10.6008 5.79508L11.4172 6.62341L7.70852 10.3334L5.23607 7.86008L6.0641 7.03175L7.70852 8.68841L10.6008 5.79508Z" fill="currentColor" />
              </svg>
            </div>
            <span>{isVerifying ? 'Verifying...' : 'Verify & Continue'}</span>
            <div className="btn-r-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.4374 7.41666L7.30021 4.29L8.12825 3.46166L12.665 8L8.12825 12.5383L7.30021 11.71L10.4374 8.58333H3.33496V7.41666H10.4374Z" fill="currentColor" />
              </svg>
            </div>
          </button>

          <div className="otp-resend-wrapper">
            {canResend ? (
              <button className="resend-link-btn" onClick={handleResend}>
                Didn't receive OTP? <span className="blue-bold">Resend OTP</span>
              </button>
            ) : (
              <p className="resend-timer-text">Resend OTP in <span className="blue-bold">{formatTime(timer)} min</span></p>
            )}
          </div>

          <div className="otp-security-notice">
            <div className="notice-lock-v">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.11969 4.25V3.75C3.11969 3.21 3.25089 2.70667 3.51329 2.24C3.76929 1.78667 4.11489 1.42667 4.55009 1.16C4.99809 0.886667 5.48129 0.75 5.99969 0.75C6.51809 0.75 7.00129 0.886667 7.44929 1.16C7.88449 1.42667 8.23009 1.78667 8.48609 2.24C8.74849 2.70667 8.87969 3.21 8.87969 3.75V4.25H9.83969C9.97409 4.25 10.0877 4.29833 10.1805 4.395C10.2733 4.49167 10.3197 4.61 10.3197 4.75V10.75C10.3197 10.89 10.2733 11.0083 10.1805 11.105C10.0877 11.2017 9.97409 11.25 9.83969 11.25H2.15969C2.02529 11.25 1.91169 11.2017 1.81889 11.105C1.72609 11.0083 1.67969 10.89 1.67969 10.75V4.75C1.67969 4.61 1.72609 4.49167 1.81889 4.395C1.91169 4.29833 2.02529 4.25 2.15969 4.25H3.11969ZM9.35969 5.25H2.63969V10.25H9.35969V5.25ZM5.51969 8.12C5.37249 8.02667 5.25569 7.90333 5.16929 7.75C5.08289 7.59667 5.03969 7.43 5.03969 7.25C5.03969 7.07 5.08289 6.90333 5.16929 6.75C5.25569 6.59667 5.37249 6.475 5.51969 6.385C5.66689 6.295 5.82689 6.25 5.99969 6.25C6.17249 6.25 6.33249 6.295 6.47969 6.385C6.62689 6.475 6.74369 6.59667 6.83009 6.75C6.91649 6.90333 6.95969 7.07 6.95969 7.25C6.95969 7.43 6.91649 7.59667 6.83009 7.75C6.74369 7.90333 6.62689 8.02667 6.47969 8.12V9.25H5.51969V8.12ZM4.07969 4.25H7.91969V3.75C7.91969 3.39 7.83329 3.05667 7.66049 2.75C7.48769 2.44333 7.25409 2.2 6.95969 2.02C6.66529 1.84 6.34529 1.75 5.99969 1.75C5.65409 1.75 5.33409 1.84 5.03969 2.02C4.74529 2.2 4.51169 2.44333 4.33889 2.75C4.16609 3.05667 4.07969 3.39 4.07969 3.75V4.25Z" fill="#0ED7B5" fillOpacity="0.3" />
              </svg>
            </div>
            <span>Your information is secure and will not be shared.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const GeneratingReportModal = ({ isOpen, statusText }) => {
  if (!isOpen) return null;

  return (
    <div className="otp-overlay">
      <div className="otp-modal-card">
        <div className="otp-modal-header">
          <div className="otp-header-left">
            <div className="otp-header-shield">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 1.66667L16.85 3.18333C17.0389 3.22778 17.1944 3.32778 17.3166 3.48333C17.4388 3.63889 17.5 3.81111 17.5 4V12.3167C17.5 13.1611 17.3028 13.95 16.9084 14.6833C16.5141 15.4167 15.967 16.0167 15.2672 16.4833L10 20L4.73278 16.4833C4.03297 16.0167 3.48588 15.4167 3.09154 14.6833C2.6972 13.95 2.5 13.1611 2.5 12.3167V4C2.5 3.81111 2.56109 3.63889 2.68328 3.48333C2.80547 3.32778 2.96099 3.22778 3.14983 3.18333L10 1.66667Z" fill="#00E5FF" fillOpacity="0.18"/>
              </svg>
            </div>
            <div className="otp-header-text">
              <h4>Generating Your Report</h4>
              <span>We are preparing your clinical report. Please keep this page open.</span>
            </div>
          </div>
        </div>

        <div className="otp-body">
          <div className="btn-loader-wrapper" style={{ justifyContent: 'center', marginBottom: '10px' }}>
            <div className="btn-spinner"></div>
            <span>Generating Report - Please wait...</span>
          </div>
          <p className="otp-instruct" style={{ textAlign: 'center', marginTop: '8px' }}>
            Current status: <span className="blue-bold">{statusText || 'PROCESSING'}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

const ResultsView = ({ sessionId, onBack, onNext, skipPhotosForGeneration = false, userProfile = {} }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const navigate = (to, options = {}) => {
    if (typeof to === 'number') {
      if (to < 0) {
        router.back();
      }
      return;
    }

    if (options?.replace) {
      router.replace(to);
      return;
    }

    router.push(to);
  };
  const [isOtpOpen, setIsOtpOpen] = React.useState(false);
  const [isGeneratingOpen, setIsGeneratingOpen] = React.useState(false);
  const [generationStatus, setGenerationStatus] = React.useState('INITIALIZING');
  const [isVerifyingOtp, setIsVerifyingOtp] = React.useState(false);
  const [otpError, setOtpError] = React.useState('');
  const [consents, setConsents] = useState({
    privacy: true,
    contact: true
  });
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [userInfo, setUserInfo] = useState(() => {
    const savedName = userProfile?.name || userProfile?.fullName || (typeof window !== 'undefined' ? localStorage.getItem('user_full_name') : '') || '';
    const savedPhone = userProfile?.phone || (typeof window !== 'undefined' ? localStorage.getItem('user_phone') : '') || '';
    return { name: savedName, phone: savedPhone };
  });
  const [email, setEmail] = useState(() => userProfile?.email || (typeof window !== 'undefined' ? localStorage.getItem('user_email') : '') || '');
  const [city, setCity] = useState(() => userProfile?.city || (typeof window !== 'undefined' ? localStorage.getItem('user_city') : '') || '');
  const [formErrors, setFormErrors] = useState({});
  const [showFormErrors, setShowFormErrors] = useState(false);
  const completeData = null;

  useEffect(() => {
    const checkInitialStatus = async () => {
      if (!sessionId) return;
      try {
        const response = await dispatch(checkSessionStatusThunk(sessionId)).unwrap();
        const status = String(
          response?.data?.status ||
          response?.status ||
          response?.sessionStatus ||
          response?.state ||
          ''
        ).toUpperCase();

        const isVerified = response?.data?.isVerified || response?.isVerified;

        if (['REPORT_COMPLETE', 'COMPLETED', 'ANALYSIS_COMPLETE'].includes(status) && isVerified) {
          toast.success('Report is ready. Redirecting...');
          navigate(`/report?sessionId=${sessionId}`, { replace: true });
        }
      } catch (err) {
        console.error("Initial results check failed:", err);
      }
    };

    checkInitialStatus();
  }, [sessionId, dispatch, router]);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const pollUntilReportComplete = async () => {
    const maxAttempts = 120;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const statusResponse = await dispatch(checkSessionStatusThunk(sessionId)).unwrap();
      const rawStatus =
        statusResponse?.data?.status ||
        statusResponse?.status ||
        statusResponse?.sessionStatus ||
        statusResponse?.state ||
        'PROCESSING';

      const normalizedStatus = String(rawStatus).toUpperCase();
      setGenerationStatus(normalizedStatus);

      if (['REPORT_COMPLETE', 'COMPLETED', 'ANALYSIS_COMPLETE'].includes(normalizedStatus)) {
        return true;
      }

      if (['FAILED', 'ERROR', 'REPORT_FAILED', 'ANALYSIS_FAILED'].includes(normalizedStatus)) {
        throw new Error(`Report generation failed: ${normalizedStatus}`);
      }

      await wait(5000);
    }

    return false;
  };

  const handleLeadSubmit = async () => {
    const errors = {};
    if (!userInfo.name.trim()) errors.name = 'Name is required';
    if (!userInfo.phone.trim()) errors.phone = 'Mobile number is required';
    
    // Email is optional, but if entered, should be valid
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setShowFormErrors(true);
      return;
    }

    const resolvedName = userInfo.name.trim();
    const resolvedPhone = userInfo.phone.trim();
    const resolvedEmail = email.trim() || `${resolvedPhone}@hairsncare.app`;
    const resolvedCity = city.trim() || 'NA';

    if (!consents.privacy) {
      toast.warning("Please accept the privacy policy to continue.");
      return;
    }

    try {
      setIsCreatingLead(true);

      const leadResponse = await dispatch(createLeadThunk({
        name: resolvedName,
        phone: resolvedPhone,
        email: resolvedEmail,
        city: resolvedCity,
        sessionId: sessionId,
        consentPrivacyPolicy: true,
        consentToContact: true
      })).unwrap();

      if (leadResponse.success) {
        setOtpError('');
        setIsOtpOpen(true);
        toast.info('OTP sent. Please verify to start report generation.');
      } else {
        toast.error(leadResponse.message || "Failed to create lead");
      }
    } catch (err) {
      console.error("Lead creation failed:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsCreatingLead(false);
    }
  };

  const handleOtpVerify = async (code) => {
    try {
      if (!sessionId) {
        toast.error('Session not found. Please restart the assessment.');
        return;
      }

      setOtpError('');
      setIsGeneratingOpen(false);
      setIsVerifyingOtp(true);
      const verifyResponse = await dispatch(verifyOtpThunk({ sessionId, otp: code })).unwrap();
      const successValue = verifyResponse?.success;
      const isOtpVerified =
        successValue === true ||
        successValue === 1 ||
        String(successValue).toLowerCase() === 'true';

      if (isOtpVerified) {
        setIsOtpOpen(false);
        setIsGeneratingOpen(true);
        setGenerationStatus('OTP_VERIFIED');

        const isComplete = await pollUntilReportComplete();
        setIsGeneratingOpen(false);

        if (!isComplete) {
          toast.error('Report generation is taking longer than expected. Please try again shortly.');
          return;
        }

        toast.success('Report generated successfully. Redirecting...');
        navigate(`/report?sessionId=${sessionId}`, { replace: true });
        return;
      }

      setIsGeneratingOpen(false);
      const otpFailureMessage = verifyResponse?.message || verifyResponse?.error || 'Invalid OTP. Please try again.';
      setOtpError(otpFailureMessage);
      toast.error(otpFailureMessage);
    } catch (error) {
      console.error('OTP verification failed:', error);
      setIsGeneratingOpen(false);
      setOtpError('OTP verification failed. Please try again.');
      toast.error('OTP verification failed. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="ai-results-container">
      <header className="prep-header">
        <div className="header-left-group">
          <div className="prep-logo">
            <Link href="/">
              <img src="/logo.png" alt="HairSnCare" />
            </Link>
          </div>
        </div>
        <div className="res-status-pill">
          <span className="pill-dot"></span>
          Analysis Complete
        </div>
      </header>

      <main className="res-content-main">
        <div className="res-hero">
          <div className="res-badge-gold">
            <SparklesIcon />
            Hair Intelligence Report Prepared
          </div>
          <h1 className="res-hero-title">
            Your <span className="text-cyan">FREE</span> Hair Analysis <span className="text-gold">Is Ready</span>
          </h1>
          <p className="res-hero-subtitle">
            Your personalized Hair Intelligence Report is prepared. Unlock it to view your complete results.
          </p>
          <div className="res-step-indicator">
            <div className="step-dot-success"></div>
            <div className="res-step-pill-wrapper">
              <div className="res-step-pill-fill"></div>
            </div>
            <span className="res-step-text">Step 2 of 2</span>
          </div>
        </div>

        <div className="res-grid-layout">
          {/* Left Column - Preview */}
          <div className="res-col-left">
            <div className="res-preview-title-row">
              <div className="title-indicator-cyan"></div>
              <span>Your Report Preview</span>
            </div>

            <div className="res-preview-card locked">
              <div className="locked-report-bg">
                <img src="/yourreportpreview.png" alt="Report Preview" />
              </div>
              <div className="lock-overlay">
                <div className="floating-badges-stack">
                  {completeData?.dseResult?.hairHealthIndex && (
                    <div className="f-badge badge-amber">
                      <FaChartBar />
                      <span>HHI Score: {completeData.dseResult.hairHealthIndex}/100</span>
                    </div>
                  )}
                  {completeData?.clinicalNarrative?.conditions?.[0] && (
                    <div className="f-badge badge-cyan">
                      <FaStethoscope />
                      <span>Condition: {completeData.clinicalNarrative.conditions[0].name}</span>
                    </div>
                  )}
                  <div className="f-badge badge-amber">
                    <FaLock style={{ fontSize: '10px' }} />
                    <span>Detailed Diagnosis Locked</span>
                  </div>
                  <div className="f-badge badge-cyan">
                    <svg width="15" height="14" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.79026 1.90167L13.3533 11.5267C13.431 11.6589 13.4485 11.8028 13.4058 11.9583C13.363 12.1139 13.2716 12.2345 13.1317 12.32C13.0462 12.3745 12.949 12.4017 12.8401 12.4017H1.73742C1.57415 12.4017 1.43614 12.3433 1.3234 12.2267C1.21067 12.11 1.1543 11.9739 1.1543 11.8183C1.1543 11.7095 1.17762 11.6122 1.22427 11.5267L6.78728 1.90167C6.86503 1.76167 6.98166 1.67028 7.13716 1.62751C7.29266 1.58473 7.44038 1.60223 7.58033 1.68001C7.67363 1.73445 7.74361 1.80834 7.79026 1.90167ZM2.7404 11.235H11.8371L7.28877 3.36001L2.7404 11.235ZM6.70565 9.48501H7.8719V10.6517H6.70565V9.48501ZM6.70565 5.40167H7.8719V8.31834H6.70565V5.40167Z" fill="#00E5FF" />
                    </svg>
                    <span>Multiple contributing factors detected</span>
                  </div>
                </div>

                <div className="lock-center-badge">
                  <div className="lock-circle-premium">
                    <svg width="27" height="26" viewBox="0 0 27 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20.7914 10.6641H21.8577C22.1562 10.6641 22.4086 10.7671 22.6147 10.9733C22.8209 11.1795 22.9239 11.4319 22.9239 11.7305V22.3945C22.9239 22.6931 22.8209 22.9455 22.6147 23.1517C22.4086 23.3579 22.1562 23.4609 21.8577 23.4609H4.7977C4.49915 23.4609 4.2468 23.3579 4.04066 23.1517C3.83452 22.9455 3.73145 22.6931 3.73145 22.3945V11.7305C3.73145 11.4319 3.83452 11.1795 4.04066 10.9733C4.2468 10.7671 4.49915 10.6641 4.7977 10.6641H5.86395V9.59766C5.86395 8.24687 6.20515 6.98852 6.88755 5.82258C7.54151 4.6993 8.43005 3.81063 9.55317 3.15656C10.7189 2.47406 11.9771 2.13281 13.3277 2.13281C14.6783 2.13281 15.9365 2.47406 17.1022 3.15656C18.2253 3.81063 19.1139 4.6993 19.7678 5.82258C20.4502 6.98852 20.7914 8.24687 20.7914 9.59766V10.6641ZM18.6589 10.6641V9.59766C18.6589 8.63078 18.4208 7.73855 17.9446 6.92098C17.4683 6.1034 16.8214 5.45645 16.004 4.98012C15.1865 4.50379 14.2944 4.26562 13.3277 4.26562C12.361 4.26562 11.4689 4.50379 10.6514 4.98012C9.83395 5.45645 9.18709 6.1034 8.71083 6.92098C8.23457 7.73855 7.99645 8.63078 7.99645 9.59766V10.6641H18.6589ZM12.2614 14.9297V19.1953H14.3939V14.9297H12.2614Z" fill="#F4C430" />
                    </svg>

                  </div>
                  <div className="lock-text-box">
                    <h3 className="lock-title-text">Your full report is locked</h3>
                    <p className="lock-subtitle-text">Unlock to view your complete diagnosis and personalized treatment plan.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="res-col-right">
            <div className="unlock-card-header">
              <div className="title-indicator-gold"></div>
              <span>Unlock Access</span>
            </div>
            <div className="res-unlock-card">

              <div className="unlock-benefits-list">
                <h4 className="benefit-title">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.91996 1.66668C10.3808 1.66668 10.8074 1.78668 11.2 2.02668C11.5925 2.26668 11.904 2.59112 12.1344 3.00001C12.3648 3.4089 12.48 3.85334 12.48 4.33334C12.48 4.81334 12.3648 5.25779 12.1344 5.66668H15.04V7.00001H13.76V13.6667C13.76 13.8533 13.6981 14.0111 13.5744 14.14C13.4506 14.2689 13.2992 14.3333 13.12 14.3333H2.87996C2.70076 14.3333 2.54929 14.2689 2.42556 14.14C2.30183 14.0111 2.23996 13.8533 2.23996 13.6667V7.00001H0.959961V5.66668H3.86556C3.63516 5.25779 3.51996 4.81334 3.51996 4.33334C3.51996 3.85334 3.63516 3.4089 3.86556 3.00001C4.09596 2.59112 4.40743 2.26668 4.79996 2.02668C5.19249 1.78668 5.61916 1.66668 6.07996 1.66668C6.45543 1.66668 6.80956 1.74668 7.14236 1.90668C7.47516 2.06668 7.76103 2.2889 7.99996 2.57334C8.23889 2.2889 8.52476 2.06668 8.85756 1.90668C9.19036 1.74668 9.54449 1.66668 9.91996 1.66668ZM7.35996 7.00001H3.51996V13H7.35996V7.00001ZM12.48 7.00001H8.63996V13H12.48V7.00001ZM6.07996 3.00001C5.84956 3.00001 5.63623 3.06001 5.43996 3.18001C5.24369 3.30001 5.08796 3.46223 4.97276 3.66668C4.85756 3.87112 4.79996 4.09334 4.79996 4.33334C4.79996 4.68001 4.91516 4.98223 5.14556 5.24001C5.37596 5.49779 5.65756 5.64001 5.99036 5.66668H7.35996V4.33334C7.35996 4.00445 7.25543 3.71557 7.04636 3.46668C6.83729 3.21779 6.57916 3.06668 6.27196 3.01334L6.07996 3.00001ZM9.91996 3.00001C9.58716 3.00001 9.29703 3.12001 9.04956 3.36001C8.80209 3.60001 8.66556 3.89334 8.63996 4.24001V5.66668H9.91996C10.2528 5.66668 10.5429 5.54668 10.7904 5.30668C11.0378 5.06668 11.1744 4.77334 11.2 4.42668V4.33334C11.2 4.09334 11.1424 3.87112 11.0272 3.66668C10.912 3.46223 10.7562 3.30001 10.56 3.18001C10.3637 3.06001 10.1504 3.00001 9.91996 3.00001Z" fill="#F4C430" />
                  </svg>
                  <span>What You'll Unlock</span>
                </h4>
                <div className="benefit-items">
                  <div className="benefit-item b-score">
                    <div className="b-icon-v">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 8C0 3.58172 3.58172 0 8 0H16C20.4183 0 24 3.58172 24 8V16C24 20.4183 20.4183 24 16 24H8C3.58172 24 0 20.4183 0 16V8Z" fill="#020A18" fill-opacity="0.4" />
                        <path d="M14.5 7.37C15 7.37 15.46 7.5 15.88 7.76C16.3 8.02 16.63 8.37333 16.87 8.82C17.1233 9.28666 17.25 9.80333 17.25 10.37C17.25 11.1433 17.07 11.8867 16.71 12.6C16.4033 13.2067 15.9667 13.79 15.4 14.35C14.96 14.79 14.4367 15.22 13.83 15.64C13.49 15.8733 13.0433 16.1533 12.49 16.48L12.25 16.62L12.01 16.48C11.43 16.14 10.9633 15.8467 10.61 15.6C9.97667 15.16 9.43333 14.7067 8.98 14.24C8.40667 13.64 7.97333 13.02 7.68 12.38L6.75 12.37V11.37L7.36 11.38C7.28667 11.0467 7.25 10.71 7.25 10.37C7.25 9.80333 7.37667 9.28666 7.63 8.82C7.87 8.37333 8.2 8.02 8.62 7.76C9.04 7.5 9.5 7.37 10 7.37C10.4333 7.37 10.8633 7.47666 11.29 7.69C11.65 7.86333 11.97 8.09 12.25 8.37C12.53 8.09 12.85 7.86333 13.21 7.69C13.6367 7.47666 14.0667 7.37 14.5 7.37ZM14.5 8.37C14.2333 8.37 13.9633 8.435 13.69 8.565C13.4167 8.695 13.1733 8.86666 12.96 9.08L12.25 9.79L11.54 9.08C11.3267 8.86666 11.0833 8.695 10.81 8.565C10.5367 8.435 10.2667 8.37 10 8.37C9.68 8.37 9.38667 8.45666 9.12 8.63C8.85333 8.80333 8.64167 9.04166 8.485 9.345C8.32833 9.64833 8.25 9.99333 8.25 10.38C8.25 10.7133 8.29333 11.0467 8.38 11.38L9.47 11.37L10.5 9.65L12 12.15L12.47 11.37H14.75V12.37H13.03L12 14.1L10.5 11.6L10.03 12.37L8.8 12.38C9.18667 13.0467 9.77667 13.6967 10.57 14.33C10.9233 14.61 11.3267 14.8933 11.78 15.18C11.92 15.2667 12.0767 15.36 12.25 15.46C12.4233 15.36 12.58 15.2667 12.72 15.18C13.1733 14.8933 13.5767 14.61 13.93 14.33C14.69 13.7233 15.2633 13.1 15.65 12.46C16.05 11.7933 16.25 11.1 16.25 10.38C16.25 9.99333 16.1733 9.64666 16.02 9.34C15.8667 9.03333 15.6567 8.79666 15.39 8.63C15.1233 8.46333 14.8267 8.37666 14.5 8.37Z" fill="#F4C430" />
                      </svg>
                    </div>
                    <span>Hair Health Score & Risk Level</span>
                    <div className="b-check-v">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.98249 7.59001L9.39849 2.99001L10.0705 3.70001L4.98249 9.01001L1.92969 5.82001L2.60169 5.12001L4.98249 7.59001Z" fill="#2E4A66" />
                      </svg>
                    </div>
                  </div>
                  <div className="benefit-item b-stage">
                    <div className="b-icon-v">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 8C0 3.58172 3.58172 0 8 0H16C20.4183 0 24 3.58172 24 8V16C24 20.4183 20.4183 24 16 24H8C3.58172 24 0 20.4183 0 16V8Z" fill="#020A18" fill-opacity="0.4" />
                        <path d="M7.25 12.25H8.25V16.75H7.25V12.25ZM8.75 13.25H9.75V16.75H8.75V13.25ZM14.25 10.25H15.25V16.75H14.25V10.25ZM15.75 11.25H16.75V16.75H15.75V11.25ZM10.75 7.25H11.75V16.75H10.75V7.25ZM12.25 8.25H13.25V16.75H12.25V8.25Z" fill="#00E5FF" />
                      </svg>
                    </div>
                    <span>Hair Loss Stage (Norwood / Ludwig)</span>
                    <div className="b-check-v">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.98249 7.59001L9.39849 2.99001L10.0705 3.70001L4.98249 9.01001L1.92969 5.82001L2.60169 5.12001L4.98249 7.59001Z" fill="#2E4A66" />
                      </svg>
                    </div>
                  </div>
                  <div className="benefit-item b-root">
                    <div className="b-icon-v">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 8C0 3.58172 3.58172 0 8 0H16C20.4183 0 24 3.58172 24 8V16C24 20.4183 20.4183 24 16 24H8C3.58172 24 0 20.4183 0 16V8Z" fill="#020A18" fill-opacity="0.4" />
                        <path d="M12.6 7.31999L14.22 10.13C14.2933 10.25 14.3117 10.3767 14.275 10.51C14.2383 10.6433 14.16 10.7433 14.04 10.81L13.39 11.19L13.89 12.06L13.02 12.56L12.52 11.69L11.88 12.06C11.76 12.1333 11.6333 12.1517 11.5 12.115C11.3667 12.0783 11.2633 12 11.19 11.88L10.27 10.29C9.93 10.3967 9.62667 10.5667 9.36 10.8C9.09333 11.0333 8.88333 11.3133 8.73 11.64C8.57667 11.9667 8.5 12.3133 8.5 12.68C8.5 12.9867 8.55333 13.2833 8.66 13.57C9.06667 13.31 9.51333 13.18 10 13.18C10.4133 13.18 10.7983 13.275 11.155 13.465C11.5117 13.655 11.8067 13.9133 12.04 14.24L15.88 12.02L16.38 12.88L12.44 15.16C12.48 15.3333 12.5 15.5067 12.5 15.68C12.5 15.8533 12.4833 16.02 12.45 16.18H16.5V17.18H8C7.84 16.9667 7.71667 16.7333 7.63 16.48C7.54333 16.2267 7.5 15.96 7.5 15.68C7.5 15.1867 7.63667 14.7333 7.91 14.32C7.63667 13.8067 7.5 13.26 7.5 12.68C7.5 12.1933 7.59667 11.7267 7.79 11.28C7.98333 10.8467 8.25 10.4683 8.59 10.145C8.93 9.82166 9.32 9.57666 9.76 9.40999L9.57 9.06999C9.47667 8.90999 9.43 8.74166 9.43 8.56499C9.43 8.38833 9.475 8.22333 9.565 8.06999C9.655 7.91666 9.77667 7.79333 9.93 7.69999L11.23 6.94999C11.39 6.85666 11.5583 6.81166 11.735 6.81499C11.9117 6.81833 12.0767 6.86333 12.23 6.94999C12.3833 7.03666 12.5067 7.15999 12.6 7.31999ZM10 14.18C9.72667 14.18 9.475 14.2483 9.245 14.385C9.015 14.5217 8.83333 14.705 8.7 14.935C8.56667 15.165 8.5 15.4133 8.5 15.68C8.5 15.8533 8.53 16.02 8.59 16.18H11.41C11.47 16.02 11.5 15.8533 11.5 15.68C11.5 15.4133 11.4333 15.165 11.3 14.935C11.1667 14.705 10.985 14.5217 10.755 14.385C10.525 14.2483 10.2733 14.18 10 14.18ZM11.73 7.81999L10.43 8.56999L11.81 10.95L13.11 10.2L11.73 7.81999Z" fill="#0ED7B5" />
                      </svg>
                    </div>
                    <span>Root Cause Analysis</span>
                    <div className="b-check-v">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.98249 7.59001L9.39849 2.99001L10.0705 3.70001L4.98249 9.01001L1.92969 5.82001L2.60169 5.12001L4.98249 7.59001Z" fill="#2E4A66" />
                      </svg>
                    </div>
                  </div>
                  <div className="benefit-item b-plan">
                    <div className="b-icon-v">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 8C0 3.58172 3.58172 0 8 0H16C20.4183 0 24 3.58172 24 8V16C24 20.4183 20.4183 24 16 24H8C3.58172 24 0 20.4183 0 16V8Z" fill="#020A18" fill-opacity="0.4" />
                        <path d="M15.8905 8.11002C16.2771 8.49669 16.5371 8.95002 16.6705 9.47002C16.8038 9.97669 16.8038 10.4834 16.6705 10.99C16.5371 11.5167 16.2771 11.97 15.8905 12.35L12.3505 15.89C11.9705 16.2767 11.5171 16.5367 10.9905 16.67C10.4838 16.8034 9.97714 16.8034 9.47047 16.67C8.95047 16.5367 8.49714 16.2767 8.11047 15.89C7.7238 15.5034 7.4638 15.05 7.33047 14.53C7.19714 14.0234 7.19714 13.5167 7.33047 13.01C7.4638 12.4834 7.7238 12.03 8.11047 11.65L11.6505 8.11002C12.0305 7.72335 12.4838 7.46335 13.0105 7.33002C13.5171 7.19669 14.0238 7.19669 14.5305 7.33002C15.0505 7.46335 15.5038 7.72335 15.8905 8.11002ZM13.0605 13.77L10.2305 10.94L8.82047 12.35C8.56047 12.61 8.38547 12.9117 8.29547 13.255C8.20547 13.5984 8.20547 13.9417 8.29547 14.285C8.38547 14.6284 8.5588 14.9284 8.81547 15.185C9.07214 15.4417 9.37214 15.615 9.71547 15.705C10.0588 15.795 10.4021 15.795 10.7455 15.705C11.0888 15.615 11.3905 15.44 11.6505 15.18L13.0605 13.77ZM15.1805 8.82002C14.9271 8.56002 14.6288 8.38502 14.2855 8.29502C13.9421 8.20502 13.5988 8.20502 13.2555 8.29502C12.9121 8.38502 12.6105 8.56002 12.3505 8.82002L10.9405 10.23L13.7705 13.06L15.1805 11.65C15.4405 11.39 15.6155 11.0884 15.7055 10.745C15.7955 10.4017 15.7955 10.0584 15.7055 9.71502C15.6155 9.37169 15.4405 9.07335 15.1805 8.82002Z" fill="#F4C430" />
                      </svg>
                    </div>
                    <span>Personalized Treatment Plan</span>
                    <div className="b-check-v">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.98249 7.59001L9.39849 2.99001L10.0705 3.70001L4.98249 9.01001L1.92969 5.82001L2.60169 5.12001L4.98249 7.59001Z" fill="#2E4A66" />
                      </svg>
                    </div>
                  </div>
                  <div className="benefit-item b-recovery">
                    <div className="b-icon-v">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 8C0 3.58172 3.58172 0 8 0H16C20.4183 0 24 3.58172 24 8V16C24 20.4183 20.4183 24 16 24H8C3.58172 24 0 20.4183 0 16V8Z" fill="#020A18" fill-opacity="0.4" />
                        <path d="M10.5 7V8H13.5V7H14.5V8H16.5C16.64 8 16.7583 8.04833 16.855 8.145C16.9517 8.24167 17 8.36 17 8.5V16.5C17 16.64 16.9517 16.7583 16.855 16.855C16.7583 16.9517 16.64 17 16.5 17H7.5C7.36 17 7.24167 16.9517 7.145 16.855C7.04833 16.7583 7 16.64 7 16.5V8.5C7 8.36 7.04833 8.24167 7.145 8.145C7.24167 8.04833 7.36 8 7.5 8H9.5V7H10.5ZM16 11.5H8V16H16V11.5ZM13.52 12.07L14.22 12.78L11.75 15.25L9.98 13.48L10.69 12.78L11.75 13.84L13.52 12.07ZM9.5 9H8V10.5H16V9H14.5V9.5H13.5V9H10.5V9.5H9.5V9Z" fill="#00E5FF" />
                      </svg>
                    </div>
                    <span>12-Month Recovery Plan</span>
                    <div className="b-check-v">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.98249 7.59001L9.39849 2.99001L10.0705 3.70001L4.98249 9.01001L1.92969 5.82001L2.60169 5.12001L4.98249 7.59001Z" fill="#2E4A66" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="res-form-section">
                <h3 className="form-heading">Unlock Your Full Report</h3>
                <p className="form-subheading">Fill in your details to receive your report.</p>

                <div className="res-input-row">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    placeholder="Your Name" 
                    value={userInfo.name}
                    onChange={(e) => setUserInfo(prev => ({ ...prev, name: e.target.value }))}
                    className={(showFormErrors && formErrors.name) ? 'input-error' : ''}
                  />
                  {showFormErrors && formErrors.name && <span className="field-error-msg">{formErrors.name}</span>}
                </div>

                <div className="res-input-row">
                  <label>Mobile Number</label>
                  <input 
                    type="text" 
                    placeholder="Your Phone" 
                    value={userInfo.phone}
                    onChange={(e) => setUserInfo(prev => ({ ...prev, phone: e.target.value }))}
                    className={(showFormErrors && formErrors.phone) ? 'input-error' : ''}
                  />
                  {showFormErrors && formErrors.phone && <span className="field-error-msg">{formErrors.phone}</span>}
                </div>

                <div className="res-input-row">
                  <label>Email Address</label>
                  <div className={`input-with-icon ${(showFormErrors && formErrors.email) ? 'input-error' : ''}`}>
                    <div className="i-icon">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.23961 2H13.7596C13.9388 2 14.0903 2.06444 14.214 2.19333C14.3377 2.32222 14.3996 2.48 14.3996 2.66667V13.3333C14.3996 13.52 14.3377 13.6778 14.214 13.8067C14.0903 13.9356 13.9388 14 13.7596 14H2.23961C2.06041 14 1.90894 13.9356 1.78521 13.8067C1.66148 13.6778 1.59961 13.52 1.59961 13.3333V2.66667C1.59961 2.48 1.66148 2.32222 1.78521 2.19333C1.90894 2.06444 2.06041 2 2.23961 2ZM13.1196 4.82667L8.05081 9.56L2.87961 4.81333V12.6667H13.1196V4.82667ZM3.21241 3.33333L8.03801 7.77333L12.7996 3.33333H3.21241Z" fill="#2E4A66" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (showFormErrors) setFormErrors(prev => ({ ...prev, email: '' }));
                      }}
                    />
                  </div>
                  {showFormErrors && formErrors.email && <span className="field-error-msg">{formErrors.email}</span>}
                </div>

                <div className="res-input-row">
                  <label>City</label>
                  <div className={`input-with-icon ${(showFormErrors && formErrors.city) ? 'input-error' : ''}`}>
                    <div className="i-icon">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8.00023 13.36L11.1618 10.0533C11.7421 9.45777 12.1346 8.75555 12.3394 7.94666C12.5357 7.15555 12.5357 6.36443 12.3394 5.57332C12.1346 4.76443 11.7442 4.05999 11.1682 3.45999C10.5922 2.85999 9.91597 2.45332 9.13943 2.23999C8.37997 2.03555 7.6205 2.03555 6.86103 2.23999C6.0845 2.45332 5.40823 2.85999 4.83223 3.45999C4.25623 4.05999 3.86583 4.76443 3.66103 5.57332C3.46477 6.36443 3.46477 7.15555 3.66103 7.94666C3.86583 8.75555 4.25837 9.45777 4.83863 10.0533L8.00023 13.36ZM8.00023 15.24L3.92983 11C3.18743 10.2355 2.68823 9.32888 2.43223 8.27999C2.17623 7.26666 2.17623 6.25332 2.43223 5.23999C2.68823 4.1911 3.1853 3.28221 3.92343 2.51332C4.66157 1.74443 5.5341 1.22221 6.54103 0.946656C7.51383 0.688879 8.48663 0.688879 9.45943 0.946656C10.4664 1.22221 11.3389 1.74443 12.077 2.51332C12.8152 3.28221 13.3122 4.1911 13.5682 5.23999C13.8242 6.25332 13.8242 7.26666 13.5682 8.27999C13.3122 9.32888 12.813 10.2355 12.0706 11L8.00023 15.24ZM8.00023 8.09332C8.23063 8.09332 8.44397 8.03332 8.64023 7.91332C8.8365 7.79332 8.99223 7.6311 9.10743 7.42666C9.22263 7.22221 9.28023 6.99999 9.28023 6.75999C9.28023 6.51999 9.22263 6.29777 9.10743 6.09332C8.99223 5.88888 8.8365 5.72666 8.64023 5.60666C8.44397 5.48666 8.23063 5.42666 8.00023 5.42666C7.76983 5.42666 7.5565 5.48666 7.36023 5.60666C7.16397 5.72666 7.00823 5.88888 6.89303 6.09332C6.77783 6.29777 6.72023 6.51999 6.72023 6.75999C6.72023 6.99999 6.77783 7.22221 6.89303 7.42666C7.00823 7.6311 7.16397 7.79332 7.36023 7.91332C7.5565 8.03332 7.76983 8.09332 8.00023 8.09332ZM8.00023 9.42666C7.53943 9.42666 7.11277 9.30666 6.72023 9.06666C6.3277 8.82666 6.01623 8.50221 5.78583 8.09332C5.55543 7.68443 5.44023 7.23777 5.44023 6.75332C5.44023 6.26888 5.55543 5.82443 5.78583 5.41999C6.01623 5.01555 6.3277 4.69332 6.72023 4.45332C7.11277 4.21332 7.53943 4.09332 8.00023 4.09332C8.46103 4.09332 8.8877 4.21332 9.28023 4.45332C9.67277 4.69332 9.98423 5.01555 10.2146 5.41999C10.445 5.82443 10.5602 6.26888 10.5602 6.75332C10.5602 7.23777 10.445 7.68443 10.2146 8.09332C9.98423 8.50221 9.67277 8.82666 9.28023 9.06666C8.8877 9.30666 8.46103 9.42666 8.00023 9.42666Z" fill="#2E4A66" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter your city"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (showFormErrors) setFormErrors(prev => ({ ...prev, city: '' }));
                      }}
                    />
                  </div>
                  {showFormErrors && formErrors.city && <span className="field-error-msg">{formErrors.city}</span>}
                </div>



                <div className="res-security-banner">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 0L0 2.625V6.125C0 10.3838 2.975 14 7 14C11.025 14 14 10.3838 14 6.125V2.625L7 0Z" fill="#0ED7B5" />
                  </svg>
                  <span>We use your details to generate and securely deliver your personalized report.</span>
                </div>
                <div className="res-btn-container">
                  <button
                    className={`btn-unlock-gold ${isCreatingLead ? 'is-generating' : ''}`}
                    onClick={handleLeadSubmit}
                    disabled={isCreatingLead}
                  >
                    {isCreatingLead ? (
                      <div className="btn-loader-wrapper">
                        <div className="btn-spinner"></div>
                        <span>Creating access...</span>
                      </div>
                    ) : 'Unlock My Report'}
                  </button>
                </div>

                <div className="btn-lock-sec">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.11969 4.25V3.75C3.11969 3.21 3.25089 2.70667 3.51329 2.24C3.76929 1.78667 4.11489 1.42667 4.55009 1.16C4.99809 0.886667 5.48129 0.75 5.99969 0.75C6.51809 0.75 7.00129 0.886667 7.44929 1.16C7.88449 1.42667 8.23009 1.78667 8.48609 2.24C8.74849 2.70667 8.87969 3.21 8.87969 3.75V4.25H9.83969C9.97409 4.25 10.0877 4.29833 10.1805 4.395C10.2733 4.49167 10.3197 4.61 10.3197 4.75V10.75C10.3197 10.89 10.2733 11.0083 10.1805 11.105C10.0877 11.2017 9.97409 11.25 9.83969 11.25H2.15969C2.02529 11.25 1.91169 11.2017 1.81889 11.105C1.72609 11.0083 1.67969 10.89 1.67969 10.75V4.75C1.67969 4.61 1.72609 4.49167 1.81889 4.395C1.91169 4.29833 2.02529 4.25 2.15969 4.25H3.11969ZM9.35969 5.25H2.63969V10.25H9.35969V5.25ZM5.51969 8.12C5.37249 8.02667 5.25569 7.90333 5.16929 7.75C5.08289 7.59667 5.03969 7.43 5.03969 7.25C5.03969 7.07 5.08289 6.90333 5.16929 6.75C5.25569 6.59667 5.37249 6.475 5.51969 6.385C5.66689 6.295 5.82689 6.25 5.99969 6.25C6.17249 6.25 6.33249 6.295 6.47969 6.385C6.62689 6.475 6.74369 6.59667 6.83009 6.75C6.91649 6.90333 6.95969 7.07 6.95969 7.25C6.95969 7.43 6.91649 7.59667 6.83009 7.75C6.74369 7.90333 6.62689 8.02667 6.47969 8.12V9.25H5.51969V8.12ZM4.07969 4.25H7.91969V3.75C7.91969 3.39 7.83329 3.05667 7.66049 2.75C7.48769 2.44333 7.25409 2.2 6.95969 2.02C6.66529 1.84 6.34529 1.75 5.99969 1.75C5.65409 1.75 5.33409 1.84 5.03969 2.02C4.74529 2.2 4.51169 2.44333 4.33889 2.75C4.16609 3.05667 4.07969 3.39 4.07969 3.75V4.25Z" fill="#0ED7B5" fillOpacity="0.3" />
                  </svg>
                  <span>Your information is secure and will not be shared.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <OtpModal
          isOpen={isOtpOpen}
          onClose={() => {
            setIsOtpOpen(false);
            setOtpError('');
          }}
          onVerify={handleOtpVerify}
          phone={userInfo.phone}
          isVerifying={isVerifyingOtp}
          errorMessage={otpError}
          onClearError={() => setOtpError('')}
        />

        <GeneratingReportModal
          isOpen={isGeneratingOpen}
          statusText={generationStatus}
        />

        {/* Feature Footer */}
        <div className="res-features-footer">
          <div className="res-feat-item">
            <div className="feat-icon-v b-sec">
              <svg width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.4141 0.833292L17.2624 2.34996C17.4513 2.3944 17.6068 2.4944 17.729 2.64996C17.8512 2.80551 17.9123 2.97774 17.9123 3.16663V11.4833C17.9123 12.3277 17.7151 13.1166 17.3207 13.85C16.9264 14.5833 16.3793 15.1833 15.6795 15.65L10.4141 19.1666L5.14879 15.65C4.44897 15.1833 3.90188 14.5833 3.50753 13.85C3.11319 13.1166 2.91602 12.3277 2.91602 11.4833V3.16663C2.91602 2.97774 2.97711 2.80551 3.0993 2.64996C3.22149 2.4944 3.37701 2.3944 3.56585 2.34996L10.4141 0.833292ZM10.4141 2.53329L4.58227 3.83329V11.4833C4.58227 12.05 4.71279 12.5777 4.97383 13.0666C5.23488 13.5555 5.59868 13.9555 6.06523 14.2666L10.4141 17.1666L14.7631 14.2666C15.2296 13.9555 15.5934 13.5555 15.8544 13.0666C16.1155 12.5777 16.246 12.05 16.246 11.4833V3.83329L10.4141 2.53329ZM14.1299 6.84996L15.2963 8.03329L9.99758 13.3333L6.46513 9.79996L7.64817 8.61663L9.99758 10.9833L14.1299 6.84996Z" fill="#00E5FF" />
              </svg>
            </div>
            <div className="feat-text-v">
              <h4>Secure & Private</h4>
              <p>End-to-end encrypted</p>
            </div>
          </div>
          <div className="res-feat-item">
            <div className="feat-icon-v b-storage">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 12V7C19 5.89543 18.1046 5 17 5H12L10 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H18M19 12L22 15M19 12L16 15M13.5 13C13.5 14.3807 12.3807 15.5 11 15.5C9.61929 15.5 8.5 14.3807 8.5 13C8.5 11.6193 9.61929 10.5 11 10.5C12.3807 10.5 13.5 11.6193 13.5 13Z" stroke="#F4C430" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="feat-text-v">
              <h4>No Photo Storage</h4>
              <p>Images never saved</p>
            </div>
          </div>
          <div className="res-feat-item">
            <div className="feat-icon-v b-clinic">
              <svg width="19" height="17" viewBox="0 0 19 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.83188 15V10H12.4969V15H14.9963V1.66667H3.3325V15H5.83188ZM7.49813 15H10.8306V11.6667H7.49813V15ZM16.6625 15H18.3288V16.6667H0V15H1.66625V0.833334C1.66625 0.6 1.74679 0.402779 1.90786 0.241667C2.06893 0.080555 2.2661 0 2.49938 0H15.8294C16.0627 0 16.2598 0.080555 16.4209 0.241667C16.582 0.402779 16.6625 0.6 16.6625 0.833334V15ZM8.33125 5V3.33333H9.9975V5H11.6638V6.66667H9.9975V8.33333H8.33125V6.66667H6.665V5H8.33125Z" fill="#0ED7B5" />
              </svg>
            </div>
            <div className="feat-text-v">
              <h4>Clinic-Grade AI</h4>
              <p>Used by professionals</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const UploadCardMain = ({ label, status, icon, previewUrl, onDelete, onUpload, showError }) => {
  const fileInputRef = React.useRef(null);

  const handleClick = () => {
    if (!previewUrl && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUpload(file);
      e.target.value = ''; // Reset to allow re-uploading the same file
    }
  };

  return (
    <div 
      className={`ai-upload-item-card ${previewUrl ? 'has-photo' : ''} ${showError ? 'has-error' : ''}`} 
      onClick={handleClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileChange}
      />
      {previewUrl ? (
        <div className="ai-photo-preview-container">
          <img src={previewUrl} alt={label} className="ai-uploaded-img" />
          <div className="ai-photo-overlay-bottom">
            <div className="photo-added-tag">
              <FaCheckCircle style={{ color: '#F4C430', fontSize: '12px' }} />
              <span>Photo Added</span>
            </div>
            <button className="photo-delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <FaTrashAlt />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ai-upload-icon-wrapper">
            {icon}
          </div>
          <div className="ai-upload-item-text">
            <span className="ai-upload-item-label">{label}</span>
            <span className={`ai-upload-item-status ${status.toLowerCase()}`}>{status}</span>
          </div>
          {showError && <span className="error-msg-under">Photo required</span>}
        </>
      )}
    </div>
  );
};

const StatusCompletedIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g filter="url(#filter0_d_5_1455)">
      <path d="M12 24C12 17.3726 17.3726 12 24 12C30.6274 12 36 17.3726 36 24C36 30.6274 30.6274 36 24 36C17.3726 36 12 30.6274 12 24Z" fill="#F4C430" shape-rendering="crispEdges" />
      <path d="M22.6436 26.12L28.5316 19.9866L29.4276 20.9333L22.6436 28.0133L18.5732 23.76L19.4692 22.8266L22.6436 26.12Z" fill="#021220" />
    </g>
    <defs>
      <filter id="filter0_d_5_1455" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix" />
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
        <feOffset />
        <feGaussianBlur stdDeviation="6" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.9569 0 0 0 0 0.7686 0 0 0 0 0.1882 0 0 0 0.4 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_5_1455" />
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_5_1455" result="shape" />
      </filter>
    </defs>
  </svg>

);

const StatusActiveIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g filter="url(#filter0_d_5_1463)">
      <path d="M12 24C12 17.3726 17.3726 12 24 12C30.6274 12 36 17.3726 36 24C36 30.6274 30.6274 36 24 36C17.3726 36 12 30.6274 12 24Z" fill="#00E5FF" shape-rendering="crispEdges" />
      <path d="M20 24C20 21.7909 21.7909 20 24 20C26.2091 20 28 21.7909 28 24C28 26.2091 26.2091 28 24 28C21.7909 28 20 26.2091 20 24Z" fill="white" />
    </g>
    <defs>
      <filter id="filter0_d_5_1463" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix" />
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
        <feOffset />
        <feGaussianBlur stdDeviation="6" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0.898 0 0 0 0 1 0 0 0 0.5 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_5_1463" />
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_5_1463" result="shape" />
      </filter>
    </defs>
  </svg>
);
const StatusPendingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12Z" fill="#054358" />
    <path d="M8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12Z" fill="#6B85A6" />
  </svg>
);

const ProcClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 18.3334C8.912 18.3334 7.872 18.1167 6.88 17.6834C5.93067 17.2612 5.08533 16.6639 4.344 15.8917C3.60267 15.1195 3.02933 14.2389 2.624 13.25C2.208 12.2167 2 11.1334 2 10C2 8.86671 2.208 7.78337 2.624 6.75004C3.02933 5.76115 3.60267 4.8806 4.344 4.10837C5.08533 3.33615 5.93067 2.73893 6.88 2.31671C7.872 1.88338 8.912 1.66671 10 1.66671C11.088 1.66671 12.128 1.88338 13.12 2.31671C14.0693 2.73893 14.9147 3.33615 15.656 4.10837C16.3973 4.8806 16.9707 5.76115 17.376 6.75004C17.792 7.78337 18 8.86671 18 10C18 11.1334 17.792 12.2167 17.376 13.25C16.9707 14.2389 16.3973 15.1195 15.656 15.8917C14.9147 16.6639 14.0693 17.2612 13.12 17.6834C12.128 18.1167 11.088 18.3334 10 18.3334ZM10 16.6667C11.1627 16.6667 12.24 16.3612 13.232 15.75C14.192 15.1612 14.9547 14.3667 15.52 13.3667C16.1067 12.3334 16.4 11.2112 16.4 10C16.4 8.78893 16.1067 7.66671 15.52 6.63338C14.9547 5.63338 14.192 4.83893 13.232 4.25004C12.24 3.63893 11.1627 3.33337 10 3.33337C8.83733 3.33337 7.76 3.63893 6.768 4.25004C5.808 4.83893 5.04533 5.63338 4.48 6.63338C3.89333 7.66671 3.6 8.78893 3.6 10C3.6 11.2112 3.89333 12.3334 4.48 13.3667C5.04533 14.3667 5.808 15.1612 6.768 15.75C7.76 16.3612 8.83733 16.6667 10 16.6667ZM10.8 10H14V11.6667H9.2V5.83337H10.8V10Z" fill="#00E5FF" />
  </svg>
);

const ProcInfoIcon = () => (
  <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 20.3334C8.912 20.3334 7.872 20.1167 6.88 19.6834C5.93067 19.2612 5.08533 18.6639 4.344 17.8917C3.60267 17.1195 3.02933 16.2389 2.624 15.25C2.208 14.2167 2 13.1334 2 12C2 10.8667 2.208 9.78337 2.624 8.75004C3.02933 7.76115 3.60267 6.8806 4.344 6.10837C5.08533 5.33615 5.93067 4.73893 6.88 4.31671C7.872 3.88338 8.912 3.66671 10 3.66671C11.088 3.66671 12.128 3.88338 13.12 4.31671C14.0693 4.73893 14.9147 5.33615 15.656 6.10837C16.3973 6.8806 16.9707 7.76115 17.376 8.75004C17.792 9.78337 18 10.8667 18 12C18 13.1334 17.792 14.2167 17.376 15.25C16.9707 16.2389 16.3973 17.1195 15.656 17.8917C14.9147 18.6639 14.0693 19.2612 13.12 19.6834C12.128 20.1167 11.088 20.3334 10 20.3334ZM10 18.6667C11.1627 18.6667 12.24 18.3612 13.232 17.75C14.192 17.1612 14.9547 16.3667 15.52 15.3667C16.1067 14.3334 16.4 13.2112 16.4 12C16.4 10.7889 16.1067 9.66671 15.52 8.63338C14.9547 7.63338 14.192 6.83893 13.232 6.25004C12.24 5.63893 11.1627 5.33337 10 5.33337C8.83733 5.33337 7.76 5.63893 6.768 6.25004C5.808 6.83893 5.04533 7.63338 4.48 8.63338C3.89333 9.66671 3.6 10.7889 3.6 12C3.6 13.2112 3.89333 14.3334 4.48 15.3667C5.04533 16.3667 5.808 17.1612 6.768 17.75C7.76 18.3612 8.83733 18.6667 10 18.6667ZM9.2 7.83337H10.8V9.50004H9.2V7.83337ZM9.2 11.1667H10.8V16.1667H9.2V11.1667Z" fill="#9FB4D0" />
  </svg>
);

const AiEngineIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.12039 4C9.46599 4 9.78599 4.09 10.0804 4.27C10.3748 4.45 10.6084 4.69333 10.7812 5C10.954 5.30667 11.0404 5.64 11.0404 6V12.82C10.234 12.18 9.16519 11.7467 7.83399 11.52L7.52679 13.48C8.76839 13.7067 9.66439 14.13 10.2148 14.75C10.7652 15.37 11.0404 16.2867 11.0404 17.5C11.0404 17.9533 10.9316 18.37 10.714 18.75C10.4964 19.13 10.2052 19.4333 9.84039 19.66C9.47559 19.8867 9.07559 20 8.64039 20C8.20519 20 7.80519 19.8867 7.44039 19.66C7.07559 19.4333 6.78439 19.13 6.56679 18.75C6.34919 18.37 6.24039 17.9533 6.24039 17.5V17.14C6.67559 17.3 7.10439 17.4133 7.52679 17.48L7.83399 15.52C7.19399 15.4 6.47719 15.1467 5.68359 14.76C5.27399 14.56 4.94439 14.2567 4.69479 13.85C4.44519 13.4433 4.32039 12.9933 4.32039 12.5C4.32039 11.7 4.49959 11.0433 4.85799 10.53C5.21639 10.0167 5.75399 9.66667 6.47079 9.48L7.20039 9.28V6C7.20039 5.64 7.28679 5.30667 7.45959 5C7.63239 4.69333 7.86599 4.45 8.16039 4.27C8.45479 4.09 8.77479 4 9.12039 4ZM12.0004 3.36C11.642 2.93333 11.2132 2.6 10.714 2.36C10.2148 2.12 9.68359 2 9.12039 2C8.42919 2 7.78919 2.18 7.20039 2.54C6.61159 2.9 6.14439 3.38667 5.79879 4C5.45319 4.61333 5.28039 5.28 5.28039 6V7.78C4.44839 8.12667 3.78919 8.64667 3.30279 9.34C2.70119 10.2067 2.40039 11.26 2.40039 12.5C2.40039 13.2733 2.57319 13.9867 2.91879 14.64C3.26439 15.2933 3.73159 15.8267 4.32039 16.24V17.5C4.32039 18.3133 4.51559 19.0633 4.90599 19.75C5.29639 20.4367 5.82119 20.9833 6.48039 21.39C7.13959 21.7967 7.85959 22 8.64039 22C9.30599 22 9.92999 21.85 10.5124 21.55C11.0948 21.25 11.5908 20.84 12.0004 20.32C12.41 20.84 12.906 21.25 13.4884 21.55C14.0708 21.85 14.6948 22 15.3604 22C16.1412 22 16.8612 21.7967 17.5204 21.39C18.1796 20.9833 18.7044 20.4367 19.0948 19.75C19.4852 19.0633 19.6804 18.3133 19.6804 17.5V16.24C20.2692 15.8267 20.7364 15.2933 21.082 14.64C21.4276 13.9867 21.6004 13.2733 21.6004 12.5C21.6004 11.26 21.2996 10.2067 20.698 9.34C20.2116 8.64667 19.5524 8.12667 18.7204 7.78V6C18.7204 5.28 18.5476 4.61333 18.202 4C17.8564 3.38667 17.3892 2.9 16.8004 2.54C16.2116 2.18 15.5716 2 14.8804 2C14.3172 2 13.786 2.12 13.2868 2.36C12.7876 2.6 12.3588 2.93333 12.0004 3.36ZM17.7604 17.14V17.5C17.7604 17.9533 17.6516 18.37 17.434 18.75C17.2164 19.13 16.9252 19.4333 16.5604 19.66C16.1956 19.8867 15.7956 20 15.3604 20C14.9252 20 14.5252 19.8867 14.1604 19.66C13.7956 19.4333 13.5044 19.13 13.2868 18.75C13.0692 18.37 12.9604 17.9533 12.9604 17.5C12.9604 16.2867 13.2356 15.37 13.786 14.75C14.3364 14.13 15.2324 13.7067 16.474 13.48L16.1668 11.52C14.8356 11.7467 13.7668 12.18 12.9604 12.82V6C12.9604 5.64 13.0468 5.30667 13.2196 5C13.3924 4.69333 13.626 4.45 13.9204 4.27C14.2148 4.09 14.5348 4 14.8804 4C15.226 4 15.546 4.09 15.8404 4.27C16.1348 4.45 16.3684 4.69333 16.5412 5C16.714 5.30667 16.8004 5.64 16.8004 6V9.28L17.53 9.48C18.2468 9.66667 18.7844 10.0167 19.1428 10.53C19.5012 11.0433 19.6804 11.7 19.6804 12.5C19.6804 12.9933 19.5556 13.4433 19.306 13.85C19.0564 14.2567 18.7268 14.56 18.3172 14.76C17.5236 15.1467 16.8068 15.4 16.1668 15.52L16.474 17.48C16.8964 17.4133 17.3252 17.3 17.7604 17.14Z" fill="#021220" />
  </svg>

);

const FrontViewIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.31982 22.5C4.31982 21.0467 4.67182 19.7 5.37582 18.46C6.05422 17.26 6.96942 16.3067 8.12142 15.6C9.31182 14.8667 10.6046 14.5 11.9998 14.5C13.395 14.5 14.6878 14.8667 15.8782 15.6C17.0302 16.3067 17.9454 17.26 18.6238 18.46C19.3278 19.7 19.6798 21.0467 19.6798 22.5H17.7598C17.7598 21.42 17.4974 20.4133 16.9726 19.48C16.4606 18.5733 15.7694 17.8533 14.899 17.32C14.003 16.7733 13.0366 16.5 11.9998 16.5C10.963 16.5 9.99662 16.7733 9.10062 17.32C8.23022 17.8533 7.53902 18.5733 7.02702 19.48C6.50222 20.4133 6.23982 21.42 6.23982 22.5H4.31982ZM11.9998 13.5C10.9502 13.5 9.98382 13.2267 9.10062 12.68C8.23022 12.1467 7.53902 11.4267 7.02702 10.52C6.50222 9.6 6.23982 8.59333 6.23982 7.5C6.23982 6.40667 6.50222 5.4 7.02702 4.48C7.53902 3.57333 8.23022 2.85333 9.10062 2.32C9.98382 1.77333 10.9502 1.5 11.9998 1.5C13.0494 1.5 14.0158 1.77333 14.899 2.32C15.7694 2.85333 16.4606 3.57333 16.9726 4.48C17.4974 5.4 17.7598 6.40667 17.7598 7.5C17.7598 8.59333 17.4974 9.6 16.9726 10.52C16.4606 11.4267 15.7694 12.1467 14.899 12.68C14.0158 13.2267 13.0494 13.5 11.9998 13.5ZM11.9998 11.5C12.691 11.5 13.331 11.32 13.9198 10.96C14.5086 10.6 14.9758 10.1133 15.3214 9.5C15.667 8.88667 15.8398 8.22 15.8398 7.5C15.8398 6.78 15.667 6.11333 15.3214 5.5C14.9758 4.88667 14.5086 4.4 13.9198 4.04C13.331 3.68 12.691 3.5 11.9998 3.5C11.3086 3.5 10.6686 3.68 10.0798 4.04C9.49102 4.4 9.02382 4.88667 8.67822 5.5C8.33262 6.11333 8.15982 6.78 8.15982 7.5C8.15982 8.22 8.33262 8.88667 8.67822 9.5C9.02382 10.1133 9.49102 10.6 10.0798 10.96C10.6686 11.32 11.3086 11.5 11.9998 11.5Z" fill="#00E5FF" />
  </svg>
);

const TopViewIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.9599 1V4.06C14.0991 4.20667 15.1519 4.6 16.1183 5.24C17.0847 5.88 17.8751 6.70333 18.4895 7.71C19.1039 8.71667 19.4815 9.81333 19.6223 11H22.5599V13H19.6223C19.4815 14.1867 19.1039 15.2833 18.4895 16.29C17.8751 17.2967 17.0847 18.12 16.1183 18.76C15.1519 19.4 14.0991 19.7933 12.9599 19.94V23H11.0399V19.94C9.90074 19.7933 8.84794 19.4 7.88154 18.76C6.91514 18.12 6.12474 17.2967 5.51034 16.29C4.89594 15.2833 4.51834 14.1867 4.37754 13H1.43994V11H4.37754C4.51834 9.81333 4.89594 8.71667 5.51034 7.71C6.12474 6.70333 6.91514 5.88 7.88154 5.24C8.84794 4.6 9.90074 4.20667 11.0399 4.06V1H12.9599ZM11.9999 6C10.9631 6 9.99674 6.27333 9.10074 6.82C8.23034 7.35333 7.53914 8.07333 7.02714 8.98C6.50234 9.91333 6.23994 10.92 6.23994 12C6.23994 13.08 6.50234 14.0867 7.02714 15.02C7.53914 15.9267 8.23034 16.6467 9.10074 17.18C9.99674 17.7267 10.9631 18 11.9999 18C13.0367 18 14.0031 17.7267 14.8991 17.18C15.7695 16.6467 16.4607 15.9267 16.9727 15.02C17.4975 14.0867 17.7599 13.08 17.7599 12C17.7599 10.92 17.4975 9.91333 16.9727 8.98C16.4607 8.07333 15.7695 7.35333 14.8991 6.82C14.0031 6.27333 13.0367 6 11.9999 6ZM11.9999 10C12.3455 10 12.6655 10.09 12.9599 10.27C13.2543 10.45 13.4879 10.6933 13.6607 11C13.8335 11.3067 13.9199 11.64 13.9199 12C13.9199 12.36 13.8335 12.6933 13.6607 13C13.4879 13.3067 13.2543 13.55 12.9599 13.73C12.6655 13.91 12.3455 14 11.9999 14C11.6543 14 11.3343 13.91 11.0399 13.73C10.7455 13.55 10.5119 13.3067 10.3391 13C10.1663 12.6933 10.0799 12.36 10.0799 12C10.0799 11.64 10.1663 11.3067 10.3391 11C10.5119 10.6933 10.7455 10.45 11.0399 10.27C11.3343 10.09 11.6543 10 11.9999 10Z" fill="#00E5FF" />
  </svg>
);

const SideViewLeftIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.98702 11H19.6798V13H7.98702L13.1518 18.36L11.7886 19.78L4.31982 12L11.7886 4.22003L13.1518 5.64003L7.98702 11Z" fill="#00E5FF" />
  </svg>
);

const SideViewRightIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.0126 11L10.8478 5.64003L12.211 4.22003L19.6798 12L12.211 19.78L10.8478 18.36L16.0126 13H4.31982V11H16.0126Z" fill="#00E5FF" />
  </svg>
);

const TipsBulbIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.3841 14.5833H9.2001V10.4167H10.8001V14.5833H11.6161C11.6694 14.1056 11.8188 13.6389 12.0641 13.1833C12.2774 12.7722 12.5921 12.3278 13.0081 11.85L13.2321 11.6C13.5414 11.2667 13.7121 11.0833 13.7441 11.05C14.0854 10.6056 14.3468 10.1167 14.5281 9.58333C14.7094 9.05 14.8001 8.49444 14.8001 7.91667C14.8001 7.01667 14.5814 6.17778 14.1441 5.4C13.7174 4.64444 13.1414 4.04444 12.4161 3.6C11.6694 3.14444 10.8641 2.91667 10.0001 2.91667C9.1361 2.91667 8.33076 3.14444 7.5841 3.6C6.85876 4.04444 6.28276 4.64444 5.8561 5.4C5.41876 6.17778 5.2001 7.01667 5.2001 7.91667C5.2001 8.49444 5.29076 9.05 5.4721 9.58333C5.65343 10.1167 5.91476 10.6 6.2561 11.0333C6.2881 11.0778 6.45876 11.2667 6.7681 11.6L6.9921 11.85C7.4081 12.3278 7.72276 12.7722 7.9361 13.1833C8.18143 13.6389 8.33076 14.1056 8.3841 14.5833ZM8.4001 16.25V17.0833H11.6001V16.25H8.4001ZM5.0081 12.0833C4.5601 11.5056 4.21343 10.8667 3.9681 10.1667C3.72276 9.44444 3.6001 8.69444 3.6001 7.91667C3.6001 6.70555 3.89343 5.58333 4.4801 4.55C5.04543 3.55 5.8081 2.75556 6.7681 2.16667C7.7601 1.55556 8.83743 1.25 10.0001 1.25C11.1628 1.25 12.2401 1.55556 13.2321 2.16667C14.1921 2.75556 14.9548 3.55 15.5201 4.55C16.1068 5.58333 16.4001 6.70555 16.4001 7.91667C16.4001 8.69444 16.2774 9.44444 16.0321 10.1667C15.7868 10.8667 15.4401 11.5056 14.9921 12.0833C14.9174 12.1833 14.7681 12.35 14.5441 12.5833C14.1281 13.0389 13.8348 13.4 13.6641 13.6667C13.3548 14.1333 13.2001 14.5778 13.2001 15V17.0833C13.2001 17.3833 13.1281 17.6611 12.9841 17.9167C12.8401 18.1722 12.6454 18.375 12.4001 18.525C12.1548 18.675 11.8881 18.75 11.6001 18.75H8.4001C8.1121 18.75 7.84543 18.675 7.6001 18.525C7.35476 18.375 7.1601 18.1722 7.0161 17.9167C6.8721 17.6611 6.8001 17.3833 6.8001 17.0833V15C6.8001 14.5778 6.64543 14.1333 6.3361 13.6667C6.16543 13.4 5.8721 13.0389 5.4561 12.5833C5.2321 12.35 5.08276 12.1833 5.0081 12.0833Z" fill="#F4C430" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="16" height="15" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.75813 1.83C10.0884 1.83 10.3937 1.7475 10.6739 1.5825C10.9541 1.4175 11.1768 1.195 11.3419 0.915C11.5071 0.635 11.5897 0.33 11.5897 0H12.4304C12.4304 0.33 12.5129 0.635 12.6781 0.915C12.8432 1.195 13.0659 1.4175 13.3461 1.5825C13.6263 1.7475 13.9316 1.83 14.2619 1.83V2.67C13.9316 2.67 13.6263 2.7525 13.3461 2.9175C13.0659 3.0825 12.8432 3.305 12.6781 3.585C12.5129 3.865 12.4304 4.17 12.4304 4.5H11.5897C11.5897 4.17 11.5071 3.865 11.3419 3.585C11.1768 3.305 10.9541 3.0825 10.6739 2.9175C10.3937 2.7525 10.0884 2.67 9.75813 2.67V1.83ZM0 6.75C0.810675 6.75 1.5663 6.545 2.26689 6.135C2.94745 5.735 3.4879 5.195 3.88824 4.515C4.29858 3.815 4.50375 3.06 4.50375 2.25H6.005C6.005 3.06 6.21017 3.815 6.62051 4.515C7.02085 5.195 7.5613 5.735 8.24186 6.135C8.94245 6.545 9.69808 6.75 10.5088 6.75V8.25C9.69808 8.25 8.94245 8.455 8.24186 8.865C7.5613 9.265 7.02085 9.805 6.62051 10.485C6.21017 11.185 6.005 11.94 6.005 12.75H4.50375C4.50375 11.94 4.29858 11.185 3.88824 10.485C3.4879 9.805 2.94745 9.265 2.26689 8.865C1.5663 8.455 0.810675 8.25 0 8.25V6.75ZM2.91243 7.5C3.40283 7.77 3.8482 8.105 4.24854 8.505C4.64887 8.905 4.98415 9.35 5.25438 9.84C5.5246 9.35 5.85988 8.905 6.26021 8.505C6.66055 8.105 7.10592 7.77 7.59633 7.5C7.10592 7.23 6.66055 6.895 6.26021 6.495C5.85988 6.095 5.5246 5.65 5.25438 5.16C4.98415 5.65 4.64887 6.095 4.24854 6.495C3.8482 6.895 3.40283 7.23 2.91243 7.5ZM12.2052 9C12.2052 9.44 12.0951 9.8475 11.8749 10.2225C11.6547 10.5975 11.357 10.895 10.9816 11.115C10.6063 11.335 10.1985 11.44 9.75813 11.43V12.555C10.1985 12.555 10.6063 12.665 10.9816 12.885C11.357 13.105 11.6522 13.4025 11.8674 13.7775C12.0826 14.1525 12.1902 14.56 12.1902 15H13.3311C13.3211 14.56 13.4262 14.1525 13.6464 13.7775C13.8665 13.4025 14.1643 13.105 14.5396 12.885C14.9149 12.665 15.3228 12.555 15.7631 12.555V11.43C15.3228 11.43 14.9149 11.3225 14.5396 11.1075C14.1643 10.8925 13.8665 10.5975 13.6464 10.2225C13.4262 9.8475 13.3211 9.44 13.3311 9H12.2052Z" fill="currentColor" />
  </svg>
);

const SecureLockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.5998 8.33337H16.3998C16.6238 8.33337 16.8131 8.41393 16.9678 8.57504C17.1225 8.73615 17.1998 8.93337 17.1998 9.16671V17.5C17.1998 17.7334 17.1225 17.9306 16.9678 18.0917C16.8131 18.2528 16.6238 18.3334 16.3998 18.3334H3.5998C3.3758 18.3334 3.18647 18.2528 3.0318 18.0917C2.87714 17.9306 2.7998 17.7334 2.7998 17.5V9.16671C2.7998 8.93337 2.87714 8.73615 3.0318 8.57504C3.18647 8.41393 3.3758 8.33337 3.5998 8.33337H4.3998V7.50004C4.3998 6.44449 4.6558 5.46115 5.1678 4.55004C5.65847 3.67226 6.32514 2.97782 7.1678 2.46671C8.04247 1.93337 8.98647 1.66671 9.9998 1.66671C11.0131 1.66671 11.9571 1.93337 12.8318 2.46671C13.6745 2.97782 14.3411 3.67226 14.8318 4.55004C15.3438 5.46115 15.5998 6.44449 15.5998 7.50004V8.33337ZM4.3998 10V16.6667H15.5998V10H4.3998ZM9.1998 11.6667H10.7998V15H9.1998V11.6667ZM13.9998 8.33337V7.50004C13.9998 6.74449 13.8211 6.04726 13.4638 5.40837C13.1065 4.76949 12.6211 4.26393 12.0078 3.89171C11.3945 3.51949 10.7251 3.33337 9.9998 3.33337C9.27447 3.33337 8.60514 3.51949 7.9918 3.89171C7.37847 4.26393 6.89314 4.76949 6.5358 5.40837C6.17847 6.04726 5.9998 6.74449 5.9998 7.50004V8.33337H13.9998Z" fill="#0ED7B5" />
  </svg>
);

export default HairAssessmentFlow;

