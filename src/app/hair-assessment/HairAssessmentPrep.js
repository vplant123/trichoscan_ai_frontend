"use client";

import React from "react";
import "./HairAssessmentPrep.css";
import { FaChevronLeft, FaSpinner } from "react-icons/fa";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { toast } from "react-toastify";
import {
  createSessionThunk,
  selectCreateSessionError,
  selectCreateSessionLoading,
} from "@/redux/slices/hairAssessmentSlice";

const HairAssessmentPrep = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isCreatingSession = useAppSelector(selectCreateSessionLoading);
  const createSessionError = useAppSelector(selectCreateSessionError);

  React.useEffect(() => {
    if (createSessionError) {
      toast.error(createSessionError);
    }
  }, [createSessionError]);

  const handleBeginAssessment = async () => {
    try {
      const response = await dispatch(createSessionThunk()).unwrap();
      if (response.success && response.statusCode === 201) {
        // Store session data according to Step 2 of Roadmap
        const { sessionId, sessionToken } = response.data;
        localStorage.setItem('hair_assessment_session_id', sessionId);
        
        if (sessionToken) {
          localStorage.setItem('hair_assessment_token', sessionToken);
        }
        
        // Navigate to the diagnostic flow
        router.push("/take-hair-test-premium");
      } else {
        toast.error("Unable to start assessment. Please try again.");
      }
    } catch (error) {
      console.error("Session creation error:", error);
      toast.error("Something went wrong. Please check your connection and try again.");
    }
  };

  return (
    <div className="hair-assessment-prep-container">
      {/* Header */}
      <header className="prep-header">
        <div className="header-left-group">
          <button className="back-btn" onClick={() => router.back()}>
            <FaChevronLeft /> BACK
          </button>
          <div className="header-divider"></div>
          <div className="prep-logo">
            <Link href="/">
              <img src="/reportlogo.png" alt="HairSnCare" />
            </Link>
          </div>
        </div>
      </header>

      <main className="prep-content">


        <div className="prep-hero">
          <div className="hero-img-box">
            <img src="/hairtake.png" alt="AI Head Scan" />
          </div>
          <div className="hero-text-box">
            <h1 className="main-title-large">
              <span className="text-cyan">Intelligent</span>{" "}
              <span className="text-yellow">Hair & Scalp</span>
              <br />
              <span className="text-white">Assessment</span>
            </h1>
            <h2 className="free-analysis-tag">Expert-Level Analysis, Completely Free</h2>
            <p className="hero-description">
              This short assessment helps our AI to analyse your hair health and identify possible causes of hair loss
            </p>
          </div>
        </div>

        {/* How the Test Works */}
        <div className="prep-section-group">
          <div className="section-header">
            <div className="section-indicator"></div>
            <h2 className="section-title">How the Test Works</h2>
          </div>

          <div className="step-card">
            <div className="step-number-container">01</div>
            <div className="step-content-box">
              <div className="step-title-row">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5.008 13.5333H16.4V3.53333H3.6V14.7L5.008 13.5333ZM5.568 15.2L2 18.1167V2.7C2 2.47778 2.07733 2.28333 2.232 2.11667C2.38667 1.95 2.576 1.86667 2.8 1.86667H17.2C17.424 1.86667 17.6133 1.95 17.768 2.11667C17.9227 2.28333 18 2.47778 18 2.7V14.3667C18 14.6 17.9227 14.8 17.768 14.9667C17.6133 15.1333 17.424 15.2111 17.2 15.2H5.568ZM9.2 11.0333H10.8V12.7H9.2V11.0333ZM7.248 6.71667C7.33333 6.27222 7.50933 5.87222 7.776 5.51667C8.04267 5.16111 8.368 4.88056 8.752 4.675C9.136 4.46945 9.552 4.36667 10 4.36667C10.512 4.37778 10.9813 4.51389 11.408 4.775C11.8347 5.03611 12.1733 5.38889 12.424 5.83333C12.6747 6.27778 12.8 6.76389 12.8 7.29167C12.8 7.81945 12.6747 8.30556 12.424 8.75C12.1733 9.19445 11.8347 9.55 11.408 9.81667C10.9813 10.0833 10.512 10.2167 10 10.2167H9.2V8.53333H10C10.3307 8.53333 10.6133 8.41389 10.848 8.175C11.0827 7.93611 11.2 7.64167 11.2 7.29167C11.2 6.94167 11.0827 6.64722 10.848 6.40833C10.6133 6.16945 10.3307 6.05 10 6.05C9.712 6.05 9.45867 6.14445 9.24 6.33333C9.02133 6.52222 8.88 6.76111 8.816 7.05L7.248 6.71667Z" fill="#00E5FF" /></svg>
                <h3>Answer Questions</h3>
              </div>
              <p>Answer simple questions about your hair and scalp.</p>
            </div>
          </div>

          <div className="step-card">
            <div className="step-number-container">02</div>
            <div className="step-content-box">
              <div className="step-title-row">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.256 4.16667L6.656 5.83333H3.6V15.8333H16.4V5.83333H13.344L11.744 4.16667H8.256ZM7.6 2.5H12.4L14 4.16667H17.2C17.424 4.16667 17.6133 4.24722 17.768 4.40833C17.9227 4.56944 18 4.76667 18 5V16.6667C18 16.9 17.9227 17.0972 17.768 17.2583C17.6133 17.4194 17.424 17.5 17.2 17.5H2.8C2.576 17.5 2.38667 17.4194 2.232 17.2583C2.07733 17.0972 2 16.9 2 16.6667V5C2 4.76667 2.07733 4.56944 2.232 4.40833C2.38667 4.24722 2.576 4.16667 2.8 4.16667H6L7.6 2.5ZM10 15C9.2 15 8.464 14.7944 7.792 14.3833C7.12 13.9722 6.58667 13.4167 6.192 12.7167C5.79733 12.0167 5.6 11.25 5.6 10.4167C5.6 9.58333 5.79733 8.81667 6.192 8.11667C6.58667 7.41667 7.12 6.86111 7.792 6.45C8.464 6.03889 9.2 5.83333 10 5.83333C10.8 5.83333 11.536 6.03889 12.208 6.45C12.88 6.86111 13.4133 7.41667 13.808 8.11667C14.2027 8.81667 14.4 9.58333 14.4 10.4167C14.4 11.25 14.2027 12.0167 13.808 12.7167C13.4133 13.4167 12.88 13.9722 12.208 14.3833C11.536 14.7944 10.8 15 10 15ZM10 13.3333C10.512 13.3333 10.9813 13.2028 11.408 12.9417C11.8347 12.6806 12.1733 12.3278 12.424 11.8833C12.6747 11.4389 12.8 10.95 12.8 10.4167C12.8 9.88333 12.6747 9.39444 12.424 8.95C12.1733 8.50556 11.8347 8.15278 11.408 7.89167C10.9813 7.63056 10.512 7.5 10 7.5C9.488 7.5 9.01867 7.63056 8.592 7.89167C8.16533 8.15278 7.82667 8.50556 7.576 8.95C7.32533 9.39444 7.2 9.88333 7.2 10.4167C7.2 10.95 7.32533 11.4389 7.576 11.8833C7.82667 12.3278 8.16533 12.6806 8.592 12.9417C9.01867 13.2028 9.488 13.3333 10 13.3333Z" fill="#00E5FF" /></svg>
                <h3>Upload Photos (Optional)</h3>
              </div>
              <p>Upload scalp photos to improve diagnostic accuracy.</p>
            </div>
          </div>

          <div className="step-card">
            <div className="step-number-container">03</div>
            <div className="step-content-box">
              <div className="step-title-row">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.2 6.66665V17.5C17.2 17.7333 17.1227 17.9305 16.968 18.0916C16.8133 18.2528 16.624 18.3333 16.4 18.3333H3.6C3.376 18.3333 3.18667 18.2528 3.032 18.0916C2.87734 17.9305 2.8 17.7333 2.8 17.5V2.49998C2.8 2.26665 2.87734 2.06943 3.032 1.90831C3.18667 1.7472 3.376 1.66665 3.6 1.66665H12.4L17.2 6.66665ZM15.6 7.49998H11.6V3.33331H4.4V16.6666H15.6V7.49998ZM6.8 5.83331H9.2V7.49998H6.8V5.83331ZM6.8 9.16665H13.2V10.8333H6.8V9.16665ZM6.8 12.5H13.2V14.1666H6.8V12.5Z" fill="#00E5FF" /></svg>
                <h3>Receive Report</h3>
              </div>
              <p>Get your personalized Hair Intelligence Report with treatment guidance.</p>
            </div>
          </div>
        </div>

        {/* What You'll Receive */}
        <div className="prep-section-group">
          <div className="section-header">
            <div className="section-indicator"></div>
            <h2 className="section-title">What You'll Receive</h2>
          </div>
          <div className="receive-grid">
            <div className="receive-item">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2.28334C14.8 2.28334 15.536 2.50001 16.208 2.93334C16.88 3.36668 17.408 3.95557 17.792 4.70001C18.1973 5.47779 18.4 6.3389 18.4 7.28335C18.4 8.57223 18.112 9.81112 17.536 11C17.0453 12.0111 16.3467 12.9833 15.44 13.9167C14.736 14.65 13.8987 15.3667 12.928 16.0667C12.384 16.4556 11.6693 16.9222 10.784 17.4667L10.4 17.7L10.016 17.4667C9.08801 16.9 8.34134 16.4111 7.77601 16C6.76267 15.2667 5.89334 14.5111 5.16801 13.7333C4.25067 12.7333 3.55734 11.7 3.08801 10.6333L1.60001 10.6167V8.95001L2.57601 8.96668C2.45867 8.41112 2.40001 7.85001 2.40001 7.28335C2.40001 6.3389 2.60267 5.47779 3.00801 4.70001C3.39201 3.95557 3.92001 3.36668 4.59201 2.93334C5.26401 2.50001 6.00001 2.28334 6.80001 2.28334C7.49334 2.28334 8.18134 2.46112 8.86401 2.81668C9.44001 3.10557 9.95201 3.48335 10.4 3.95001C10.848 3.48335 11.36 3.10557 11.936 2.81668C12.6187 2.46112 13.3067 2.28334 14 2.28334ZM14 3.95001C13.5733 3.95001 13.1413 4.05834 12.704 4.27501C12.2667 4.49168 11.8773 4.77779 11.536 5.13334L10.4 6.31668L9.26401 5.13334C8.92267 4.77779 8.53334 4.49168 8.09601 4.27501C7.65867 4.05834 7.22667 3.95001 6.80001 3.95001C6.28801 3.95001 5.81867 4.09446 5.39201 4.38334C4.96534 4.67223 4.62667 5.06946 4.37601 5.57501C4.12534 6.08057 4.00001 6.65557 4.00001 7.30001C4.00001 7.85557 4.06934 8.41112 4.20801 8.96668L5.95201 8.95001L7.60001 6.08334L10 10.25L10.752 8.95001H14.4V10.6167H11.648L10 13.5L7.60001 9.33335L6.84801 10.6167L4.88001 10.6333C5.49867 11.7445 6.44267 12.8278 7.71201 13.8833C8.27734 14.35 8.92267 14.8222 9.64801 15.3C9.87201 15.4445 10.1227 15.6 10.4 15.7667C10.6773 15.6 10.928 15.4445 11.152 15.3C11.8773 14.8222 12.5227 14.35 13.088 13.8833C14.304 12.8722 15.2213 11.8333 15.84 10.7667C16.48 9.65557 16.8 8.50001 16.8 7.30001C16.8 6.65557 16.6773 6.07779 16.432 5.56668C16.1867 5.05557 15.8507 4.66112 15.424 4.38334C14.9973 4.10557 14.5227 3.96112 14 3.95001Z" fill="#0ED7B5" /></svg>
              <span>Hair Health index score</span>
            </div>
            <div className="receive-item">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.11202 2.5V15.8333H16.912V17.5H2.51202V2.5H4.11202ZM16.352 5.25L17.488 6.41667L12.912 11.1833L10.512 8.68333L7.08802 12.25L5.95202 11.0833L10.512 6.31667L12.912 8.81667L16.352 5.25Z" fill="#0ED7B5" /></svg>
              <span>Possible hair loss stage</span>
            </div>
            <div className="receive-item">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.704 13.7167L18.128 17.2833L16.992 18.4667L13.568 14.9C12.9387 15.4222 12.2507 15.8222 11.504 16.1C10.7147 16.3889 9.90399 16.5333 9.07199 16.5333C7.77066 16.5333 6.55999 16.1945 5.43999 15.5167C4.35199 14.85 3.49333 13.95 2.86399 12.8167C2.20266 11.65 1.87199 10.3889 1.87199 9.03334C1.87199 7.67779 2.20266 6.41668 2.86399 5.25001C3.49333 4.11668 4.35199 3.22223 5.43999 2.56668C6.55999 1.87779 7.77066 1.53334 9.07199 1.53334C10.3733 1.53334 11.584 1.87779 12.704 2.56668C13.792 3.22223 14.656 4.11668 15.296 5.25001C15.9467 6.41668 16.272 7.67779 16.272 9.03334C16.272 9.90001 16.1333 10.7445 15.856 11.5667C15.5893 12.3445 15.2053 13.0611 14.704 13.7167ZM13.088 13.1C13.5893 12.5667 13.9787 11.9556 14.256 11.2667C14.5333 10.5556 14.672 9.81112 14.672 9.03334C14.672 7.97779 14.416 6.99445 13.904 6.08334C13.4133 5.20556 12.7467 4.51112 11.904 4.00001C11.0293 3.46668 10.0853 3.20001 9.07199 3.20001C8.05866 3.20001 7.11466 3.46668 6.23999 4.00001C5.39733 4.51112 4.73066 5.20556 4.23999 6.08334C3.72799 6.99445 3.47199 7.97779 3.47199 9.03334C3.47199 10.0889 3.72799 11.0722 4.23999 11.9833C4.73066 12.8611 5.39733 13.5556 6.23999 14.0667C7.11466 14.6 8.05866 14.8667 9.07199 14.8667C9.81866 14.8667 10.5333 14.7222 11.216 14.4333C11.8773 14.1445 12.464 13.7389 12.976 13.2167L13.088 13.1ZM10.016 5.85001C9.73866 5.98334 9.51199 6.18612 9.33599 6.45834C9.15999 6.73056 9.07199 7.03334 9.07199 7.36668C9.07199 7.66668 9.14399 7.94445 9.28799 8.20001C9.43199 8.45556 9.62666 8.65834 9.87199 8.80834C10.1173 8.95834 10.384 9.03334 10.672 9.03334C10.992 9.03334 11.2827 8.94445 11.544 8.76667C11.8053 8.5889 12 8.35001 12.128 8.05001C12.224 8.37223 12.272 8.70001 12.272 9.03334C12.272 9.63334 12.128 10.1889 11.84 10.7C11.552 11.2111 11.1627 11.6167 10.672 11.9167C10.1813 12.2167 9.64799 12.3667 9.07199 12.3667C8.49599 12.3667 7.96266 12.2167 7.47199 11.9167C6.98133 11.6167 6.59199 11.2111 6.30399 10.7C6.01599 10.1889 5.87199 9.63334 5.87199 9.03334C5.87199 8.43334 6.01599 7.87779 6.30399 7.36668C6.59199 6.85556 6.98133 6.45001 7.47199 6.15001C7.96266 5.85001 8.49599 5.70001 9.07199 5.70001C9.39199 5.70001 9.70666 5.75001 10.016 5.85001Z" fill="#0ED7B5" /></svg>
              <span>Root cause analysis</span>
            </div>
            <div className="receive-item">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.6 1.66665V3.33331H14V5.83331C14.4373 5.83331 14.84 5.94442 15.208 6.16665C15.576 6.38887 15.8666 6.69165 16.08 7.07498C16.2933 7.45831 16.4 7.87776 16.4 8.33331V17.5C16.4 17.7333 16.3226 17.9305 16.168 18.0916C16.0133 18.2528 15.824 18.3333 15.6 18.3333H4.39998C4.17598 18.3333 3.98664 18.2528 3.83198 18.0916C3.67731 17.9305 3.59998 17.7333 3.59998 17.5V8.33331C3.59998 7.87776 3.70664 7.45831 3.91998 7.07498C4.13331 6.69165 4.42398 6.38887 4.79198 6.16665C5.15998 5.94442 5.56264 5.83331 5.99998 5.83331V3.33331H4.39998V1.66665H15.6ZM14 7.49998H5.99998C5.77598 7.49998 5.58664 7.58054 5.43198 7.74165C5.27731 7.90276 5.19998 8.09998 5.19998 8.33331V16.6666H14.8V8.33331C14.8 8.09998 14.7226 7.90276 14.568 7.74165C14.4133 7.58054 14.224 7.49998 14 7.49998ZM10.8 9.16665V10.8333H12.4V12.5H10.8V14.1666H9.19998V12.5H7.59998V10.8333H9.19998V9.16665H10.8ZM12.4 3.33331H7.59998V5.83331H12.4V3.33331Z" fill="#0ED7B5" /></svg>
              <span>Personalized treatment recommendations</span>
            </div>
          </div>
        </div>

        {/* Estimated Time */}
        <div className="prep-section-group">
          <div className="stats-card-main">
            <div className="stats-header">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C10.6944 22 9.44639 21.74 8.25599 21.22C7.11679 20.7133 6.10239 19.9967 5.21279 19.07C4.32319 18.1433 3.63519 17.0867 3.14879 15.9C2.64959 14.66 2.39999 13.36 2.39999 12C2.39999 10.64 2.64959 9.34 3.14879 8.1C3.63519 6.91333 4.32319 5.85667 5.21279 4.93C6.10239 4.00333 7.11679 3.28667 8.25599 2.78C9.44639 2.26 10.6944 2 12 2C13.3056 2 14.5536 2.26 15.744 2.78C16.8832 3.28667 17.8976 4.00333 18.7872 4.93C19.6768 5.85667 20.3648 6.91333 20.8512 8.1C21.3504 9.34 21.6 10.64 21.6 12C21.6 13.36 21.3504 14.66 20.8512 15.9C20.3648 17.0867 19.6768 18.1433 18.7872 19.07C17.8976 19.9967 16.8832 20.7133 15.744 21.22C14.5536 21.74 13.3056 22 12 22ZM12 20C13.3952 20 14.688 19.6333 15.8784 18.9C17.0304 18.1933 17.9456 17.24 18.624 16.04C19.328 14.8 19.68 13.4533 19.68 12C19.68 10.5467 19.328 9.2 18.624 7.96C17.9456 6.76 17.0304 5.80667 15.8784 5.1C14.688 4.36667 13.3952 4 12 4C10.6048 4 9.31199 4.36667 8.12159 5.1C6.96959 5.80667 6.05439 6.76 5.37599 7.96C4.67199 9.2 4.31999 10.5467 4.31999 12C4.31999 13.4533 4.67199 14.8 5.37599 16.04C6.05439 17.24 6.96959 18.1933 8.12159 18.9C9.31199 19.6333 10.6048 20 12 20ZM12.96 12H16.8V14H11.04V7H12.96V12Z" fill="#00E5FF" /></svg>
              <h2 className="section-title">Estimated Time</h2>
            </div>
            <div className="stats-grid">
              <div className="stat-unit-card">
                <span className="stat-value color-cyan">~6</span>
                <span className="stat-label">minutes</span>
              </div>
              <div className="stat-unit-card border-emerald">
                <span className="stat-value color-emerald">50+</span>
                <span className="stat-label">clinical questions</span>
              </div>
              <div className="stat-unit-card border-blue">
                <span className="stat-value color-blue">Optional</span>
                <span className="stat-label">photo upload</span>
              </div>
            </div>
          </div>
        </div>

        {/* Important Note */}
        <div className="note-box">
          <div className="note-icon-col">
            <svg width="24" height="26" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.3171 18.5833H11.1669V14.4167H12.8331V18.5833H13.6829C13.7385 18.1056 13.894 17.6389 14.1495 17.1833C14.3716 16.7722 14.6993 16.3278 15.1326 15.85L15.3658 15.6C15.688 15.2667 15.8657 15.0833 15.899 15.05C16.2545 14.6056 16.5267 14.1167 16.7155 13.5833C16.9043 13.05 16.9988 12.4944 16.9988 11.9167C16.9988 11.0167 16.771 10.1778 16.3156 9.4C15.8713 8.64444 15.2714 8.04444 14.516 7.6C13.7385 7.14444 12.8998 6.91667 12 6.91667C11.1002 6.91667 10.2616 7.14444 9.48397 7.6C8.7286 8.04444 8.12875 8.64444 7.68442 9.4C7.22898 10.1778 7.00126 11.0167 7.00126 11.9167C7.00126 12.4944 7.09568 13.05 7.28452 13.5833C7.47336 14.1167 7.74552 14.6 8.10098 15.0333C8.13431 15.0778 8.31204 15.2667 8.63418 15.6L8.86746 15.85C9.30068 16.3278 9.62838 16.7722 9.85054 17.1833C10.106 17.6389 10.2616 18.1056 10.3171 18.5833ZM10.3338 20.25V21.0833H13.6663V20.25H10.3338ZM6.80131 16.0833C6.33476 15.5056 5.97374 14.8667 5.71824 14.1667C5.46275 13.4444 5.33501 12.6944 5.33501 11.9167C5.33501 10.7056 5.64049 9.58333 6.25144 8.55C6.84019 7.55 7.63443 6.75556 8.63418 6.16667C9.66726 5.55556 10.7892 5.25 12 5.25C13.2108 5.25 14.3328 5.55556 15.3658 6.16667C16.3656 6.75556 17.1598 7.55 17.7486 8.55C18.3595 9.58333 18.665 10.7056 18.665 11.9167C18.665 12.6944 18.5373 13.4444 18.2818 14.1667C18.0263 14.8667 17.6653 15.5056 17.1987 16.0833C17.1209 16.1833 16.9654 16.35 16.7322 16.5833C16.2989 17.0389 15.9935 17.4 15.8157 17.6667C15.4936 18.1333 15.3325 18.5778 15.3325 19V21.0833C15.3325 21.3833 15.2575 21.6611 15.1076 21.9167C14.9576 22.1722 14.7549 22.375 14.4994 22.525C14.2439 22.675 13.9662 22.75 13.6663 22.75H10.3338C10.0338 22.75 9.75612 22.675 9.50063 22.525C9.24514 22.375 9.04241 22.1722 8.89245 21.9167C8.74249 21.6611 8.66751 21.3833 8.66751 21.0833V19C8.66751 18.5778 8.50644 18.1333 8.18429 17.6667C8.00656 17.4 7.70108 17.0389 7.26786 16.5833C7.03458 16.35 6.87907 16.1833 6.80131 16.0833Z" fill="#3B82F6" />
            </svg>
          </div>
          <div className="note-text-col mt-1">
            <h3>Important Note</h3>
            <p>
              TrichoScan AI provides a health information assessment only — it is NOT a substitute for professional medical advice, diagnosis, or treatment. All outputs are educational and informational in nature. Never disregard or delay seeking professional medical advice based on information from this tool. Always consult a qualified dermatologist or trichologist for clinical evaluation. Data & Privacy Notice
              <br /><br />
              This tool collects sensitive health information (hair, scalp, lifestyle, and optionally scalp photographs). Your data is processed by Anthropic Claude AI (a third-party AI service) for assessment purposes. Scalp photos are not stored on any server — they are processed in your browser and sent directly to the AI API in memory only. This tool is operated in compliance with the Digital Personal Data Protection Act, 2023 (India). Privacy Policy Terms of Service
              <br /><br />
              I understand this is an AI-generated health information assessment and not a medical diagnosis. I consent to my health data and (if uploaded) scalp photographs being processed by Anthropic Claude AI for the purpose of generating this assessment. I have read and agree to the Privacy Policy and Terms of Service.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="prep-actions">
          <button 
            className="begin-btn" 
            onClick={handleBeginAssessment}
            disabled={isCreatingSession}
          >
            {isCreatingSession ? <><FaSpinner className="spin-icon" /> Initializing...</> : "Begin Assessment"}
          </button>
          {/* <button className="subtle-btn" onClick={() => navigate("/")}>Back to Introduction</button> */}
        </div>


        <footer className="prep-footer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 11C7.44772 11 7 11.4477 7 12V13C7 13.5523 7.44772 14 8 14C8.55228 14 9 13.5523 9 13V12C9 11.4477 8.55228 11 8 11Z" fill="currentColor" />
            <path fillRule="evenodd" clipRule="evenodd" d="M4 6V5C4 2.79086 5.79086 1 8 1C10.2091 1 12 2.79086 12 5V6H13C14.1046 6 15 6.89543 15 8V13C15 14.1046 14.1046 15 13 15H3C1.89543 15 1 14.1046 1 13V8C1 6.89543 1.89543 6 3 6H4ZM10.5 6V5C10.5 3.61929 9.38071 2.5 8 2.5C6.61929 2.5 5.5 3.61929 5.5 5V6H10.5ZM3 7.5C2.72386 7.5 2.5 7.72386 2.5 8V13C2.5 13.2761 2.72386 13.5 3 13.5H13C13.2761 13.5 13.5 13.2761 13.5 13V8C13.5 7.72386 13.2761 7.5 13 7.5H3Z" fill="currentColor" />
          </svg>
          <span>Your responses remain private and are used only to generate your diagnostic report.</span>
        </footer>
      </main>
    </div>
  );
};

export default HairAssessmentPrep;
