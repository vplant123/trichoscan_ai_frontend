// @ts-nocheck
"use client";

import React from "react";
import "./report.css";
import { FiCalendar } from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  checkSessionStatusThunk,
  fetchFullResultThunk,
  downloadReportThunk,
  selectReportDataLoading,
  selectReportDownloadLoading,
} from '@/redux/slices/reportSlice';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

// Helper to format API URLs with BASE_URL if relative
const extractUrlString = (input, depth = 0) => {
  if (!input || depth > 3) return null;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof input !== 'object') return null;

  const candidate =
    input.url ??
    input.path ??
    input.src ??
    input.image ??
    input.imageUrl ??
    input.publicUrl ??
    input.secure_url;

  if (!candidate) return null;
  return extractUrlString(candidate, depth + 1);
};

const formatUrl = (urlLike) => {
  try {
    const targetUrl = extractUrlString(urlLike);
    if (!targetUrl) return null;
    const normalizedUrl = String(targetUrl);

    // Already absolute URL or browser-native source URL
    if (/^(https?:\/\/|data:|blob:)/i.test(normalizedUrl)) {
      return normalizedUrl;
    }

    if (!API_BASE_URL) return normalizedUrl;

    // Static assets (like /uploads) usually live at server root, not under /api/v1
    const serverRoot = API_BASE_URL.split('/api/v1')[0];
    const cleanBase = serverRoot.endsWith('/') ? serverRoot.slice(0, -1) : serverRoot;
    const cleanUrl = normalizedUrl.charAt(0) === '/' ? normalizedUrl : `/${normalizedUrl}`;

    return `${cleanBase}${cleanUrl}`;
  } catch (error) {
    console.error('formatUrl failed for value:', urlLike, error);
    return null;
  }
};

// Purely dynamic mapping from sessionId status API
const safeArray = (arr) => Array.isArray(arr) ? arr : [];
const normalizeTextObjects = (value, depth = 0) => {
  if (value == null || depth > 25) return value;

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTextObjects(item, depth + 1));
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);

    // Backend may send scalar fields as objects, e.g. { text: "..." }.
    if (Object.prototype.hasOwnProperty.call(value, "text")) {
      return normalizeTextObjects(value.text, depth + 1);
    }

    const normalized = {};
    for (const key of keys) {
      normalized[key] = normalizeTextObjects(value[key], depth + 1);
    }
    return normalized;
  }

  return value;
};

const normalizePayload = (payload) =>
  normalizeTextObjects(payload?.data ?? payload ?? null);
const getItems = (section) => {
  if (Array.isArray(section)) return section;
  if (section && Array.isArray(section.items)) return section.items;
  return [];
};
const asDisplayText = (value, fallback = "--") => {
  if (value == null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value && typeof value === "object") {
    const textVal =
      value.text ??
      value.value ??
      value.label ??
      value.title ??
      value.name ??
      value.note ??
      value.desc ??
      value.summary ??
      value.description;
    if (textVal != null) return String(textVal).trim() || fallback;
  }
  return fallback;
};

const asDisplayList = (value) =>
  safeArray(value)
    .map((entry) => asDisplayText(entry, ""))
    .filter((entry) => entry !== "");

const toBooleanFlag = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return fallback;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n", ""].includes(normalized)) return false;
    return fallback;
  }
  return fallback;
};

// Icon Color Mapping Utility
const getIconColor = (tone) => {
  const colorMap = {
    cyan: "#00E5FF",
    amber: "#F4C430",
    red: "#EF4444",
    green: "#10B981",
    danger: "#EF4444",
    warning: "#F4C430",
    success: "#10B981",
    slate: "#64748B"
  };
  return colorMap[tone?.toLowerCase()] || "#00E5FF";
};

// Icon Component Factory
const MealTypeIcon = ({ type, color = "#00E5FF", size = 20 }) => {
  const iconMap = {
    sun: (
      <svg width={size} height={size} viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M6.25 9C5.71 9 5.20667 8.86333 4.74 8.59C4.28667 8.32333 3.92667 7.96333 3.66 7.51C3.38667 7.04333 3.25 6.54 3.25 6C3.25 5.46 3.38667 4.95667 3.66 4.49C3.92667 4.03667 4.28667 3.67667 4.74 3.41C5.20667 3.13667 5.71 3 6.25 3C6.79 3 7.29333 3.13667 7.76 3.41C8.21333 3.67667 8.57333 4.03667 8.84 4.49C9.11333 4.95667 9.25 5.46 9.25 6C9.25 6.54 9.11333 7.04333 8.84 7.51C8.57333 7.96333 8.21333 8.32333 7.76 8.59C7.29333 8.86333 6.79 9 6.25 9ZM6.25 8C6.61 8 6.94333 7.91 7.25 7.73C7.55667 7.55 7.8 7.30667 7.98 7C8.16 6.69333 8.25 6.36 8.25 6C8.25 5.64 8.16 5.30667 7.98 5C7.8 4.69333 7.55667 4.45 7.25 4.27C6.94333 4.09 6.61 4 6.25 4C5.89 4 5.55667 4.09 5.25 4.27C4.94333 4.45 4.7 4.69333 4.52 5C4.34 5.30667 4.25 5.64 4.25 6C4.25 6.36 4.34 6.69333 4.52 7C4.7 7.30667 4.94333 7.55 5.25 7.73C5.55667 7.91 5.89 8 6.25 8ZM5.75 0.5H6.75V2H5.75V0.5ZM5.75 10H6.75V11.5H5.75V10ZM2.01 2.46L2.71 1.76L3.78 2.82L3.07 3.53L2.01 2.46ZM8.72 9.18L9.43 8.47L10.49 9.54L9.79 10.24L8.72 9.18ZM9.79 1.76L10.49 2.46L9.43 3.53L8.72 2.82L9.79 1.76ZM3.07 8.47L3.78 9.18L2.71 10.24L2.01 9.54L3.07 8.47ZM11.75 5.5V6.5H10.25V5.5H11.75ZM2.25 5.5V6.5H0.75V5.5H2.25Z"
          fill={color}
        />
      </svg>
    ),
    leaf: (
      <svg width={size} height={size} viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M10.75 1.25V2.25C10.75 3.79667 10.4767 5.11333 9.93 6.2C9.42333 7.21333 8.70667 7.98 7.78 8.5C6.9 9 5.89 9.25 4.75 9.25H2.87C2.79 9.70333 2.75 10.2033 2.75 10.75H1.75C1.75 10.07 1.80667 9.44667 1.92 8.88C1.80667 8.23333 1.75 7.35667 1.75 6.25C1.75 5.57 1.88 4.92 2.14 4.3C2.39333 3.70667 2.75167 3.17833 3.215 2.715C3.67833 2.25167 4.20667 1.89333 4.8 1.64C5.42 1.38 6.07 1.25 6.75 1.25C6.95 1.25 7.26333 1.28333 7.69 1.35C8.03667 1.40333 8.31 1.43667 8.51 1.45C8.85 1.47667 9.18333 1.48 9.51 1.46C9.90333 1.42667 10.3167 1.35667 10.75 1.25ZM6.75 2.25C6.02333 2.25 5.35 2.43333 4.73 2.8C4.13 3.15333 3.65333 3.63 3.3 4.23C2.93333 4.85 2.75 5.52333 2.75 6.25V6.77C3.05667 6.29 3.44333 5.84333 3.91 5.43C4.35667 5.03667 4.88667 4.66667 5.5 4.32L6 5.18C5.26 5.60667 4.66333 6.05667 4.21 6.53C3.73 7.03 3.37333 7.60333 3.14 8.25H4.75C5.75667 8.25 6.63167 8.03 7.375 7.59C8.11833 7.15 8.69 6.50333 9.09 5.65C9.51 4.76333 9.73 3.69333 9.75 2.44C9.41667 2.47333 9.07667 2.48333 8.73 2.47C8.41667 2.45 8.05333 2.41 7.64 2.35C7.34667 2.30333 7.15 2.275 7.05 2.265C6.95 2.255 6.85 2.25 6.75 2.25Z"
          fill={color}
        />
      </svg>
    ),
    moon: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    ),
    pill: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8.94c0-1.18-.61-2.23-1.56-2.82-.95-.58-2.18-.58-3.13 0l-8.5 5.18c-.94.59-1.56 1.64-1.56 2.82 0 1.18.62 2.24 1.57 2.82l8.5 5.17c1.95 1.19 4.31.6 5.26-.59.95-.59 1.56-1.65 1.56-2.83V8.94z"></path>
      </svg>
    ),
    drop: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
      </svg>
    ),
    shield: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
    ),
    snack: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l12-3V9a6 6 0 0 1-6 6 6 6 0 0 1-6-6z"></path>
        <path d="M6 9v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"></path>
      </svg>
    ),
    apple: (
      <svg width={size} height={size} viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M8.36998 4.12958C8.25665 4.12292 8.13165 4.13458 7.99498 4.16458C7.85831 4.19458 7.68998 4.24625 7.48998 4.31958C7.50331 4.31292 7.48998 4.31958 7.44998 4.33958L7.00998 4.50958C6.74998 4.59625 6.51998 4.63958 6.31998 4.63958C6.11998 4.63958 5.89331 4.59625 5.63998 4.50958C5.56665 4.48958 5.48331 4.45958 5.38998 4.41958L5.15998 4.32958C4.85998 4.21625 4.63998 4.15958 4.49998 4.15958C4.21331 4.16625 3.94165 4.24792 3.68498 4.40458C3.42831 4.56125 3.21998 4.77625 3.05998 5.04958C2.85331 5.41625 2.74665 5.87292 2.73998 6.41958C2.73331 6.93958 2.81665 7.48125 2.98998 8.04458C3.16331 8.60792 3.40665 9.11625 3.71998 9.56958C3.95998 9.90958 4.15665 10.1629 4.30998 10.3296C4.44998 10.4763 4.54831 10.5479 4.60498 10.5446C4.66165 10.5413 4.71665 10.5329 4.76998 10.5196C4.82331 10.5063 4.89998 10.4763 4.99998 10.4296L5.07998 10.3996C5.34665 10.2863 5.57665 10.2063 5.76998 10.1596C5.98331 10.1129 6.21498 10.0896 6.46498 10.0896C6.71498 10.0896 6.94331 10.1129 7.14998 10.1596C7.33665 10.2063 7.55331 10.2829 7.79998 10.3896L7.88998 10.4196C7.98998 10.4663 8.06498 10.4963 8.11498 10.5096C8.16498 10.5229 8.21998 10.5296 8.27998 10.5296C8.37331 10.5229 8.48331 10.4563 8.60998 10.3296C8.74998 10.1896 8.93665 9.94625 9.16998 9.59958C9.30331 9.40625 9.42331 9.20292 9.52998 8.98958C9.46331 8.93625 9.39665 8.87958 9.32998 8.81958C8.99665 8.49958 8.74331 8.13958 8.56998 7.73958C8.38331 7.31292 8.28665 6.84958 8.27998 6.34958C8.27331 5.57625 8.50665 4.87958 8.97998 4.25958C8.80665 4.19292 8.60331 4.14958 8.36998 4.12958Z"
          fill={color}
        />
      </svg>
    ),
    chain: (
      <svg width={size} height={size} viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M10.14 2.10953C10.5266 2.4962 10.7866 2.94953 10.92 3.46953C11.0533 3.9762 11.0533 4.48286 10.92 4.98953C10.7866 5.5162 10.5266 5.96953 10.14 6.34953L6.59998 9.88953C6.21998 10.2762 5.76665 10.5362 5.23998 10.6695C4.73331 10.8029 4.22665 10.8029 3.71998 10.6695C3.19998 10.5362 2.74665 10.2762 2.35998 9.88953C1.97331 9.50286 1.71331 9.04953 1.57998 8.52953C1.44665 8.02286 1.44665 7.5162 1.57998 7.00953C1.71331 6.48286 1.97331 6.02953 2.35998 5.64953L5.89998 2.10953C6.27998 1.72287 6.73331 1.46286 7.25998 1.32953C7.76665 1.1962 8.27331 1.1962 8.77998 1.32953C9.29998 1.46286 9.75331 1.72287 10.14 2.10953ZM7.30998 7.76953L4.47998 4.93953L3.06998 6.34953C2.80998 6.60953 2.63498 6.9112 2.54498 7.25453C2.45498 7.59786 2.45498 7.9412 2.54498 8.28453C2.63498 8.62786 2.80831 8.92786 3.06498 9.18453C3.32165 9.4412 3.62165 9.61453 3.96498 9.70453C4.30831 9.79453 4.65165 9.79453 4.99498 9.70453C5.33831 9.61453 5.63998 9.43953 5.89998 9.17953L7.30998 7.76953ZM9.42998 2.81953C9.17665 2.55953 8.87831 2.38453 8.53498 2.29453C8.19165 2.20453 7.84831 2.20453 7.50498 2.29453C7.16165 2.38453 6.85998 2.55953 6.59998 2.81953L5.18998 4.22953L8.01998 7.05953L9.42998 5.64953C9.68998 5.38953 9.86498 5.08786 9.95498 4.74453C10.045 4.4012 10.045 4.05786 9.95498 3.71453C9.86498 3.3712 9.68998 3.07286 9.42998 2.81953Z"
          fill={color}
        />
      </svg>
    ),
    check: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    ),
    ban: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
      </svg>
    ),
    alert: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.04h16.94a2 2 0 0 0 1.71-3.04l-8.47-14.14a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    ),
    heart: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
    ),
    clock: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    )
  };
  return iconMap[type] || iconMap.leaf;
};

// Avoid Icon Component
const AvoidIcon = ({ tone, size = 20 }) => {
  const color = getIconColor(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  );
};



const UnlockOverlay = ({ title, description, ctaText, onUnlock }) => (
  <div className="unlock-overlay-container">
    <div className="unlock-overlay flex-column-center">
      <div className="unlock-icon-shield">
        <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.7878 4.95833H11.954C12.1173 4.95833 12.2553 5.01472 12.368 5.1275C12.4808 5.24028 12.5371 5.37833 12.5371 5.54167V12.5417C12.5371 12.705 12.4808 12.8431 12.368 12.9558C12.2553 13.0686 12.1173 13.125 11.954 13.125H2.62402C2.46074 13.125 2.32274 13.0686 2.21 12.9558C2.09726 12.8431 2.04089 12.705 2.04089 12.5417V5.54167C2.04089 5.37833 2.09726 5.24028 2.21 5.1275C2.32274 5.01472 2.46074 4.95833 2.62402 4.95833H3.79027V4.375C3.79027 3.745 3.94966 3.15778 4.26843 2.61333C4.57943 2.08444 4.99928 1.66444 5.52798 1.35333C6.07223 1.03444 6.65924 0.875 7.28902 0.875C7.91879 0.875 8.50581 1.03444 9.05006 1.35333C9.57876 1.66444 9.99861 2.08444 10.3096 2.61333C10.6284 3.15778 10.7878 3.745 10.7878 4.375V4.95833ZM6.70589 9.47333V10.7917H7.87214V9.47333C8.05097 9.36444 8.19286 9.22056 8.29782 9.04167C8.40279 8.86278 8.45527 8.66833 8.45527 8.45833C8.45527 8.24833 8.40279 8.05389 8.29782 7.875C8.19286 7.69611 8.05097 7.55417 7.87214 7.44917C7.69332 7.34417 7.49894 7.29167 7.28902 7.29167C7.07909 7.29167 6.88472 7.34417 6.70589 7.44917C6.52707 7.55417 6.38517 7.69611 6.28021 7.875C6.17525 8.05389 6.12277 8.24833 6.12277 8.45833C6.12277 8.66833 6.17525 8.86278 6.28021 9.04167C6.38517 9.22056 6.52707 9.36444 6.70589 9.47333ZM9.62152 4.95833V4.375C9.62152 3.955 9.51656 3.56611 9.30663 3.20833C9.09671 2.85056 8.81292 2.56667 8.45527 2.35667C8.09762 2.14667 7.70887 2.04167 7.28902 2.04167C6.86917 2.04167 6.48042 2.14667 6.12277 2.35667C5.76512 2.56667 5.48133 2.85056 5.27141 3.20833C5.06148 3.56611 4.95652 3.955 4.95652 4.375V4.95833H9.62152Z" fill="#F4C430" />
        </svg>
      </div>
      <h5 className="unlock-title">{title}</h5>
      <p className="unlock-description">{description}</p>
      <button className="unlock-cta-btn" onClick={onUnlock}>Unlock Insights</button>
    </div>
  </div>
);

export default function TestReport({ sessionId, reportData: initialData, onDownloadPdf, onUnlockReport, isPrintMode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isReportDataLoading = useAppSelector(selectReportDataLoading);
  const isDownloading = useAppSelector(selectReportDownloadLoading);
  const initialResolved = normalizePayload(initialData);
  const FORCE_LOCKED_UI_TEST = false;
  const initialFullReport = toBooleanFlag(
    initialResolved?.flags?.fullReport ?? initialResolved?.fullReportAccess,
    false
  );
  const [reportData, setReportData] = React.useState(initialResolved);
  const [loading, setLoading] = React.useState(!initialData);
  const [resolvedSessionId, setResolvedSessionId] = React.useState(sessionId || "");
  const [fullReport, setFullReport] = React.useState(
    FORCE_LOCKED_UI_TEST ? false : initialFullReport
  );

  const handleDownloadPdf = async () => {
    const targetSessionId =
      resolvedSessionId ||
      sessionId ||
      resolvedReport?.sessionId ||
      resolvedReport?.hairTestId ||
      resolvedReport?.id ||
      localStorage.getItem('hair_assessment_session_id');

    if (!targetSessionId) {
      toast.error('Session ID not found. Please regenerate report.');
      return;
    }

    try {
      if (typeof onDownloadPdf === 'function') {
        await onDownloadPdf();
      } else {
        await dispatch(downloadReportThunk(String(targetSessionId))).unwrap();
      }

      toast.success('Report download started.');
    } catch (error) {
      console.error('Download report failed:', error);
      toast.error('Failed to download report. Please try again.');
    }
  };

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search || "");
    const querySessionId = params.get("sessionId") || params.get("id") || "";
    const storedSessionId = localStorage.getItem("hair_assessment_session_id") || "";
    const finalSessionId = sessionId || querySessionId || storedSessionId || "";

    if (finalSessionId) {
      setResolvedSessionId(finalSessionId);
      localStorage.setItem("hair_assessment_session_id", String(finalSessionId));
    }
  }, [sessionId]);

  React.useEffect(() => {
    if (initialData) {
      const resolvedInitial = normalizePayload(initialData);
      setReportData(resolvedInitial);
      setLoading(false);
      setFullReport(
        FORCE_LOCKED_UI_TEST
          ? false
          : toBooleanFlag(
            resolvedInitial?.flags?.fullReport ?? resolvedInitial?.fullReportAccess,
            Boolean(isPrintMode)
          )
      );
      return;
    }

    const getReportResults = async () => {
      if (!resolvedSessionId) return;
      try {
        setLoading(true);
        const statusResponse = await dispatch(checkSessionStatusThunk(resolvedSessionId)).unwrap();
        const normalizedStatusData = normalizePayload(statusResponse?.data ?? statusResponse);

        let finalReportData = normalizedStatusData;

        try {
          const resultResponse = await dispatch(fetchFullResultThunk(resolvedSessionId)).unwrap();
          const normalizedResultData = normalizePayload(resultResponse?.data ?? resultResponse);

          if (normalizedResultData) {
            finalReportData = {
              ...(normalizedStatusData || {}),
              ...normalizedResultData,
              fullReportAccess: true,
            };
          }
        } catch (resultError) {
          console.info("Result API not available yet, falling back to status payload.", resultError);
        }

        setReportData(finalReportData);
        setFullReport(
          FORCE_LOCKED_UI_TEST
            ? false
            : toBooleanFlag(
              finalReportData?.flags?.fullReport ?? finalReportData?.fullReportAccess,
              Boolean(isPrintMode)
            )
        );
        console.log("Loaded report data:", finalReportData);
      } catch (err) {
        console.error("Failed to fetch report:", err);
      } finally {
        setLoading(false);
      }
    };

    getReportResults();
  }, [resolvedSessionId, initialData, isPrintMode, dispatch]);

  const useStatic = (!fullReport && !isPrintMode);

  const resolvedReport = normalizePayload(reportData);
  const resolveItems = (...sources) => {
    for (const source of sources) {
      const items = getItems(source);
      if (items.length > 0) return items;
    }
    return [];
  };

  const getLifestyleEntryScore = (entry) => {
    if (!entry || typeof entry !== "object") return 0;

    let score = 0;
    if (asDisplayText(entry?.label || entry?.title || entry?.factor || entry?.name, "") !== "") score += 3;
    if (asDisplayText(entry?.tag || entry?.level || entry?.status || entry?.value, "") !== "") score += 2;
    if (asDisplayText(entry?.tone || entry?.impactTone, "") !== "") score += 1;

    const progressRaw = asDisplayText(
      entry?.progress ?? entry?.progressPct ?? entry?.progressPercentage ?? entry?.score ?? entry?.value,
      ""
    );
    const progressNum = parseFloat(String(progressRaw).replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(progressNum)) score += 3;

    return score;
  };

  const getLifestyleItemsScore = (items) =>
    (Array.isArray(items) ? items : []).reduce((acc, entry) => acc + getLifestyleEntryScore(entry), 0);

  const findLifestyleItemsDeep = (node, depth = 0, seen = new Set()) => {
    if (depth > 10 || node == null || typeof node !== "object") return [];
    if (seen.has(node)) return [];
    seen.add(node);

    if (Array.isArray(node)) {
      if (node.length > 0 && getLifestyleItemsScore(node) > 0) return node;
      for (const child of node) {
        const found = findLifestyleItemsDeep(child, depth + 1, seen);
        if (found.length > 0) return found;
      }
      return [];
    }

    const directItems = getItems(node);
    if (directItems.length > 0 && getLifestyleItemsScore(directItems) > 0) return directItems;

    const preferredKeys = [
      "lifestyleRiskFactors",
      "lifestyleAssessment",
      "lifestyleassessment",
      "analysisResults",
      "clinicalNarrative",
      "report",
      "result",
      "data",
    ];

    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const found = findLifestyleItemsDeep(node[key], depth + 1, seen);
        if (found.length > 0) return found;
      }
    }

    for (const value of Object.values(node)) {
      const found = findLifestyleItemsDeep(value, depth + 1, seen);
      if (found.length > 0) return found;
    }

    return [];
  };

  // --- STATIC FALLBACK DATA FOR LOCKED/UNAUTHORIZED VIEW ---
  const LOCKED_STATIC_DATA = {
    clinicalNarrative: {
      summary: "AI-generated clinical assessment indicates early-stage pattern-based thinning (Norwood Stage II) with secondary stress-induced shedding markers. Results suggest strong recovery potential if stimulus protocol is initiated within the next 90 days. Unlock your full clinical dossier for the complete molecular root-cause breakdown.",
      prognosis: "Positive recovery potential. Follicle viability remains high (72%) across primary zones. Stabilisation phase expected within 3-4 months with consistent topical and nutritional compliance.",
      disclaimer: "AI-generated diagnostic assessment based on profile inputs. This is not a medical diagnosis — consult a qualified trichologist for clinical confirmation.",
      conditions: [
        { classification: 'PRIMARY_CONDITION', name: "Stress-Induced (Telogen Effluvium)", explanation: "Elevated cortisol disrupting hair growth cycle and pushing follicles into premature resting phase.", probabilityPct: 82, tone: "cyan" },
        { classification: 'PRIMARY_CONDITION', name: "Nutritional Deficiency", explanation: "Iron, Vitamin D, and Biotin levels likely below optimal thresholds for hair synthesis.", probabilityPct: 74, tone: "cyan" },
        { classification: 'PRIMARY_CONDITION', name: "Hormonal Imbalance", explanation: "Elevated DHT-to-testosterone ratio detected; possible thyroid marker involvement.", probabilityPct: 61, tone: "amber" }
      ],
      nutritionalPlan: [
        { id: 1, category: "Biotin (Vitamin B7)", dosage: "5,000 mcg/day", description: "Supports keratin synthesis — deficiency causes thinning and brittle hair.", tone: "amber", icon: "chain", items: ["Eggs", "Almonds", "Sweet potato", "Salmon"], imageType: "biotin" },
        { id: 2, category: "Iron & Ferritin", dosage: "18–27 mg/day", description: "Iron deficiency reduces oxygen delivery to follicles, triggering shedding.", tone: "red", icon: "drop", items: ["Red meat", "Spinach", "Lentils", "Pumpkin seeds"], imageType: "iron" },
        { id: 3, category: "Zinc", dosage: "15–30 mg/day", description: "Critical for follicle cell repair and DHT metabolism.", tone: "cyan", icon: "shield", items: ["Oysters", "Beef", "Chickpeas", "Cashews"], imageType: "zinc" },
        { id: 4, category: "Vitamin D3", dosage: "2,000–5,000 IU/day", description: "Regulates hair follicles to initiate growth cycles — deficiency causes telogen effluvium.", tone: "amber", icon: "sun", items: ["Fatty fish", "Egg yolks", "Fortified milk"], imageType: "vitd" }
      ],
      dailyMealPlan: [
        { type: "Breakfast", menu: ["3 boiled eggs + spinach omelette", "avocado toast on whole grain", "fortified milk"], tone: "amber", icon: "sun" },
        { type: "Lunch", menu: ["Grilled salmon with quinoa", "mixed greens", "olive oil dressing"], tone: "cyan", icon: "leaf" },
        { type: "Snack", menu: ["Mixed nuts (almonds, cashews)", "Greek yogurt"], tone: "cyan", icon: "snack" },
        { type: "Dinner", menu: ["Lean chicken breast", "steamed broccoli", "sweet potato"], tone: "slate", icon: "moon" },
        { type: "Supplement", menu: ["Biotin 5000mcg + Vitamin D3 2000IU + Iron 18mg + Zinc 15mg with meals"], tone: "amber", icon: "pill" }
      ],
      toAvoid: [
        { title: "Crash Dieting", explanation: "Triggers telogen effluvium from nutrient deprivation", tone: "danger" },
        { title: "Excess Sugar", explanation: "Promotes insulin resistance which increases scalp oiliness and DHT levels", tone: "danger" },
        { title: "Trans Fats", explanation: "Promote systemic inflammation around hair follicles", tone: "danger" },
        { title: "High Sodium", explanation: "Reduces blood flow to the scalp and increases scalp inflammation", tone: "danger" },
        { title: "Processed Foods", explanation: "Disrupt nutrient absorption and hormonal balance", tone: "danger" },
        { title: "Excessive Alcohol", explanation: "Depletes zinc, B12 and folic acid — key for follicles", tone: "danger" }
      ],
      dailyRoutine: [
        { time: "Morning", activity: "Scalp massage 3-5 min", note: "stimulates blood flow to follicles" },
        { time: "Post-Wash", activity: "Apply Minoxidil on DRY scalp", note: "wet scalp reduces absorption rate" },
        { time: "Nightly", activity: "Sleep on a silk pillowcase", note: "reduces friction and mechanical breakage" }
      ],
      weeklySchedule: [
        { day: "Mon/Thu", activities: ["Scalp massage", "Minoxidil AM", "Light yoga"], locked: false },
        { day: "Tue/Fri", activities: ["Medicated shampoo", "Zinc supplement", "Iron + Vit C"], locked: true },
        { day: "Wed/Sat", activities: ["Deep conditioning", "Cardio 30 min", "Minoxidil PM"], locked: true }
      ],
      stressTechniques: [
        { name: "4-7-8 Breathing", explanation: "Activates parasympathetic system - reduces cortisol within minutes.", icon: "breathing", impact: "Lowers heart rate rapidly" },
        { name: "Scalp Self-Massage", explanation: "Increases circulation and reduces localised DHT accumulation.", icon: "massage", impact: "Boosts oxygen delivery" }
      ],
      stressFoods: [
        { name: "Dark Chocolate (85%)", explanation: "Lowers adrenaline + cortisol response" },
        { name: "Matcha Green Tea", explanation: "L-theanine promotes calm without sedation" }
      ],
      activeRisks: [
        { name: "Early Onset (Age <30)", description: "Advanced future staging risk without early intervention" },
        { name: "Elevated Stress", description: "Chronic cortisol disrupts growth cycle" }
      ],
      bloodWorkSuggestions: [
        { name: "Serum Ferritin", explanation: "Ferritin < 30 ng/ml causes hair loss even without anemia. Target > 70 ng/ml." },
        { name: "TSH (Thyroid)", explanation: "Hormonal disruption is a major cause of diffuse thinning." }
      ],
      prognosisPlan: [
        { milestone: "Shedding Control", timeline: "3-4 Months", probability: "85%" },
        { milestone: "Visible Regrowth", timeline: "6-12 Months", probability: "72%" }
      ],
      treatmentExplanation: {
        "Phase 1": "Stabilize current shedding and reduce DHT sensitivity through topical vasodilators.",
        "Phase 2": "Re-activate dormant follicles via targeted nutritional support and stimulus therapy.",
        "Phase 3": "Increase hair shaft diameter and overall global density for consolidated growth."
      }
    },
    dseResult: {
      severityBand: "Moderate",
      hairHealthIndex: 72,
      totalScore: 72,
      geneticRisk: 34,
      conditions: [
        { classification: 'CONTRIBUTING', name: "Genetic Sensitivity", explanation: "Low-moderate androgen receptor sensitivity detected.", score: 34 },
        { classification: 'MINOR', name: "Scalp Condition", explanation: "Mild sebum imbalance and minor scalp inflammation.", score: 28 }
      ],
      recommendations: [
        { name: "Topical Minoxidil (5%)", explanation: "FDA-approved vasodilator - stimulates follicle activity.", priority: "HIGH", priorityTone: "high", timeFrame: "1-3 mo" },
        { name: "Anti-DHT Complex", explanation: "Blocks DHT at the root to prevent further miniaturisation.", priority: "HIGH", priorityTone: "high", timeFrame: "Ongoing" }
      ],
      freebies: [
        { name: "Free Hair Consultation", explanation: "Get expert guidance tailored to your AI report outcomes." },
        { name: "Personalized Diet Plan", explanation: "Custom hair-synthesis nutrition plan for recovery." }
      ],
      metrics: [
        { name: "Hair Density", status: "Mild", score: 52, scoreLabel: "Mild Thinning", note: "Early-stage density reduction observed", tone: "mild", dashArray: "84.95 163.36" },
        { name: "Fall Control", status: "High Risk", score: 38, scoreLabel: "Active Shedding", note: "Above-normal daily shedding detected", tone: "high-risk", dashArray: "62.08 163.36" }
      ],
      detailedMetrics: [
        { name: "Hair Health Index", value: 91, score: 91, tone: "cyan", standing: "Top 25%", explanation: "Your overall hair health is in good shape with high potential.", benchmarkTitle: "AGE BENCHMARK (30-40)", benchmarkLines: ["Typical HHI is around 56.", "Your score of 91 places you in Top 15%."] },
        { name: "Miniaturization Rate", value: 38, score: 38, tone: "amber", standing: "Elevated", explanation: "Rate at which terminal hairs are shrinking." }
      ],
      regionalDensity: [
        { zoneId: "front", zoneName: "Frontal Zone", coveragePct: 52, status: "Moderate", note: "Mild diffuse thinning noted" },
        { zoneId: "crown", zoneName: "Crown / Vertex", coveragePct: 58, status: "Moderate", note: "Minor involvement detected" }
      ],
      lifestyleFactors: [
        { factor: "Stress Level", impactTone: "high", impactDescription: "High cortisol may trigger TE shedding.", mitigation: "Improve meditation consistency.", value: 86, label: "High" },
        { factor: "Sleep Quality", impactTone: "moderate", impactDescription: "Irregular cycles affect cell regeneration.", mitigation: "Target 7-8 hours daily.", value: 56, label: "Moderate" }
      ],
      aiInsights: [
        { name: "Hairline Analysis", severity: "Mild", explanation: "Early recession detected in temporal regions.", iconType: "hairline", tone: "mild" },
        { name: "Scalp Visibility", severity: "Significant", explanation: "Density reduction more apparent in vertex zone.", iconType: "visibility", tone: "significant" }
      ],
      visualMetrics: [
        { name: "Confidence Level", value: "High", label: "High Confidence", percent: 94, tone: "confidence" },
        { name: "Diagnostic Accuracy", value: "+32%", label: "Accuracy Boost", percent: 82, tone: "accuracy" }
      ],
      scalpInsights: [
        { name: "Hair Breakage", value: "Moderate", label: "Present", explanation: "Shaft integrity weakened by past chemical styling.", summary: "Reduce heat styling. Use wide-tooth comb.", steps: ["Switch to silk pillowcase", "Apply protein conditioner"], tone: "amber", showImage: true },
        { name: "Scalp Oiliness", value: "Elevated", label: "Mild", explanation: "Sebum accumulation noted in frontal zone.", summary: "Wash every 2-3 days with balancing shampoo.", steps: ["Apply witch hazel toner", "Avoid touching scalp"], tone: "amber" }
      ],
      predictiveRisks: [
        { name: "Age-related Progression", level: "Medium", value: 65 },
        { name: "Genetic Predisposition", level: "High", value: 88 }
      ]
    }
  };


  // DYNAMIC DATA from API
  // Merge dseResult (raw scoring) + clinicalClassification (UI metadata) so that
  // clinicalClassification fields (hhi, severity, urgency, *DashArray, etc.) always
  // take priority, while conditions / dimensionScores from dseResult remain accessible.
  const dynamicNarrative = resolvedReport?.clinicalNarrative || resolvedReport?.analysisResults || resolvedReport?.story || resolvedReport || {};
  const dynamicDse = {
    ...(resolvedReport?.dseResult || resolvedReport?.dseResults || {}),
    ...(resolvedReport?.clinicalClassification || {}),
  };

  // STATIC Fallback
  const staticNarrative = LOCKED_STATIC_DATA.clinicalNarrative;
  const staticDse = LOCKED_STATIC_DATA.dseResult;

  // Sections that are ALWAYS dynamic (Header, Clinical Insight Cards, AI Photo Analysis)
  const clinicalNarrative = dynamicNarrative;
  const dseResult = dynamicDse;

  // Sections that depend on fullReport status (Weekly Schedule, Protocol, Meal Plan)
  const lockedNarrative = dynamicNarrative;
  const lockedDse = dynamicDse;

  // Derive photo analysis visibility from flags first, then fallback to detected photo signals.
  const withPhotoAnalysisFromFlags = toBooleanFlag(
    resolvedReport?.flags?.withPhotoAnalysis,
    null
  );
  const withPhotoAnalysis = (
    withPhotoAnalysisFromFlags !== null
      ? withPhotoAnalysisFromFlags
      : !!(resolvedReport?.imagesUploaded > 0 || dseResult?.visionAdjusted || resolvedReport?.photos?.length > 0)
  );

  React.useEffect(() => {
    if (FORCE_LOCKED_UI_TEST) {
      setFullReport(false);
      return;
    }

    const canShowFullReport = toBooleanFlag(
      resolvedReport?.flags?.fullReport ?? resolvedReport?.fullReportAccess,
      false
    );

    setFullReport(isPrintMode ? true : canShowFullReport);
  }, [resolvedReport, isPrintMode, FORCE_LOCKED_UI_TEST]);

  // Phase 3 Signal: Set window.reportReady = true when UI is fully rendered
  // This is used by the /report-print/ route and the backend PDF capture service.
  React.useEffect(() => {
    if (reportData) {
      // 5s buffer to ensure all charts, regional density SVG, and AI text blocks are fully painted
      const signalTimer = setTimeout(() => {
        window.reportReady = true;
        console.log("Diagnostic Flow Readiness: window.reportReady = true (Signal Emitted)");
      }, 5000);

      return () => {
        clearTimeout(signalTimer);
        window.reportReady = false; // Reset if component unmounts or data changes
      };
    }
  }, [reportData]); // Only re-emit when reportData itself changes

  const handleUnlockReport = () => {
    if (onUnlockReport) {
      onUnlockReport();
    } else {
      // Fallback/Legacy: Local State Flip
      setFullReport(true);
      toast.success("Full Premium Report Unlocked!");
    }
  };

  const sharedThumbImage = `/report-image/IMG-4004.png`;
  const scalpRepresentativeImage = `/report-image/IMG-840.png`;
  const lifestyleImpactImage = `/report-image/IMG-2110.png`;
  const nutritionalEggImage = `/report-image/IMG-2146.png`;
  const nutritionalIronImage = `/report-image/IMG-2176.png`;
  const stressProtocolImage = `/report-image/IMG-2808.png`;
  const shaftScalpImage = `/report-image/IMG-3366.png`;
  const treatmentRecommendationImages = [
    `/report-image/treatmentRecommendation-1.png`,
    `/report-image/treatmentRecommendation-2.png`,
    `/report-image/treatmentRecommendation-3.png`,
  ];
  const section9PhaseImages = [
    `/report-image/section9-1.png`,
    `/report-image/section9-2.png`,
    `/report-image/section9-3.png`,
  ];
  const aiPhotoImageFront = `/report-image/IMG-562.png`;
  const aiPhotoImageCrown = `/report-image/IMG-579.png`;
  const aiPhotoImageTemple = `/report-image/IMG-596.png`;


  const apiPhotos = safeArray(resolvedReport?.photos);
  const findAIPho = (types) => apiPhotos.find(p => types.includes(p?.type?.toLowerCase()));
  const findRawImg = (types) => safeArray(resolvedReport?.images).find(img => types.includes((img?.type || img?.id)?.toLowerCase()))?.url;

  const normalizeMarkerPercent = (value, fallback) => {
    if (typeof value === 'number' && Number.isFinite(value)) return `${value}%`;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return fallback;
      return trimmed.endsWith('%') ? trimmed : `${trimmed}%`;
    }
    return fallback;
  };

  const fallbackAiPhotoTiles = [
    {
      id: "front-hairline",
      label: "Frontal View",
      image: findAIPho(["front", "frontal"])?.url || (!useStatic && findRawImg(["front", "frontal"])) || aiPhotoImageFront,
      zone: findAIPho(["front", "frontal"])?.marker?.label || "Recession zone",
      markerTop: findAIPho(["front", "frontal"])?.marker?.top !== undefined ? `${findAIPho(["front", "frontal"]).marker.top}%` : "37%",
      markerLeft: findAIPho(["front", "frontal"])?.marker?.left !== undefined ? `${findAIPho(["front", "frontal"]).marker.left}%` : "48%",
    },
    {
      id: "crown-view",
      label: "Crown View",
      image: findAIPho(["crown", "top", "vertex"])?.url || (!useStatic && findRawImg(["crown", "top", "vertex"])) || aiPhotoImageCrown,
      zone: findAIPho(["crown", "top", "vertex"])?.marker?.label || "Thinning zone",
      markerTop: findAIPho(["crown", "top", "vertex"])?.marker?.top !== undefined ? `${findAIPho(["crown", "top", "vertex"]).marker.top}%` : "44%",
      markerLeft: findAIPho(["crown", "top", "vertex"])?.marker?.left !== undefined ? `${findAIPho(["crown", "top", "vertex"]).marker.left}%` : "52%",
    },
    {
      id: "temple-view",
      label: "Side / Temple View",
      image: findAIPho(["left", "temple", "side"])?.url || (!useStatic && findRawImg(["left", "temple", "side"])) || aiPhotoImageTemple,
      zone: findAIPho(["left", "temple", "side"])?.marker?.label || "Temple area",
      markerTop: findAIPho(["left", "temple", "side"])?.marker?.top !== undefined ? `${findAIPho(["left", "temple", "side"]).marker.top}%` : "43%",
      markerLeft: findAIPho(["left", "temple", "side"])?.marker?.left !== undefined ? `${findAIPho(["left", "temple", "side"]).marker.left}%` : "35%",
    },
    {
      id: "right-profile",
      label: "Profile Analysis",
      image: findAIPho(["right", "profile"])?.url || (!useStatic && findRawImg(["right", "profile"])),
      zone: findAIPho(["right", "profile"])?.marker?.label || "Unstructured Zone",
      markerTop: findAIPho(["right", "profile"])?.marker?.top !== undefined ? `${findAIPho(["right", "profile"]).marker.top}%` : "50%",
      markerLeft: findAIPho(["right", "profile"])?.marker?.left !== undefined ? `${findAIPho(["right", "profile"]).marker.left}%` : "50%",
      unavailable: !findAIPho(["right", "profile"]) && (useStatic || !findRawImg(["right", "profile"])),
    },
  ];

  const aiPhotoTilesSourceCandidates = [
    resolvedReport?.aiPhotoTiles,
    resolvedReport?.analysisResults?.aiPhotoTiles,
    resolvedReport?.clinicalNarrative?.aiPhotoTiles,
    reportData?.aiPhotoTiles,
    reportData?.data?.aiPhotoTiles,
  ];
  const aiPhotoTilesSource = aiPhotoTilesSourceCandidates.find((candidate) => getItems(candidate).length > 0);

  const aiPhotoTilesFromApi = getItems(aiPhotoTilesSource).map((tile, idx) => {
    const tileId = asDisplayText(tile?.id, `api-photo-${idx + 1}`);
    const imageUrl = asDisplayText(tile?.image || tile?.url || tile?.src, "");
    const markerTop = normalizeMarkerPercent(tile?.markerTop ?? tile?.marker?.top, "50%");
    const markerLeft = normalizeMarkerPercent(tile?.markerLeft ?? tile?.marker?.left, "50%");

    return {
      id: tileId,
      label: asDisplayText(tile?.label, `View ${idx + 1}`),
      zone: asDisplayText(tile?.zone || tile?.marker?.label, "Scalp zone"),
      image: imageUrl,
      markerTop,
      markerLeft,
      unavailable: toBooleanFlag(tile?.unavailable, false),
      fromApi: true,
    };
  });

  const aiPhotoTiles = aiPhotoTilesFromApi.length > 0 ? aiPhotoTilesFromApi : fallbackAiPhotoTiles;
  const executiveSummaryObj =
    lockedNarrative?.executiveSummary && typeof lockedNarrative.executiveSummary === "object"
      ? lockedNarrative.executiveSummary
      : null;

  const clinicalSummaryText = asDisplayText(
    lockedNarrative?.executiveSummary,
    asDisplayText(lockedNarrative?.summary, "Clinical assessment pending.")
  );
  const clinicalSummaryConfidence = asDisplayText(
    executiveSummaryObj?.confidenceLabel || executiveSummaryObj?.confidenceBand,
    ""
  );

  const primaryCausesRaw = getItems(resolvedReport?.rootCausePrimary);
  const primaryCauses = primaryCausesRaw
    .sort((a, b) => {
      const scoreA = Number(a?.score || a?.contributionPct || 0);
      const scoreB = Number(b?.score || b?.contributionPct || 0);
      return scoreB - scoreA;
    })
    .map((c) => {
      const scoreNum = Number(asDisplayText(c.score || c.contributionPct, 0));
      return {
        ...c,
        title: asDisplayText(c.title || c.factor, "Analysis Complete"),
        tag: asDisplayText(c.tag || c.classification, "--"),
        score: Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, scoreNum)) : 0,
        summary: asDisplayText(c.summary || c.why, ""),
      };
    });

  // CRITICAL: Genetic Predisposition score mapping
  // Prioritize probabilityPct from clinicalClassification as it represents the calculated sensitive index
  const geneticPredispositionScore = dseResult?.probabilityPct ?? (dseResult?.geneticScore || 0);

  const secondaryCausesRaw = getItems(resolvedReport?.additionalContributingFactors);
  const secondaryCauses = secondaryCausesRaw
    .sort((a, b) => {
      const scoreA = Number(a?.score || a?.contributionPct || 0);
      const scoreB = Number(b?.score || b?.contributionPct || 0);
      return scoreB - scoreA;
    })
    .map((c) => {
      const scoreNum = Number(asDisplayText(c.score || c.contributionPct, 0));
      return {
        ...c,
        rank: c.rank || "--",
        title: asDisplayText(c.title || c.factor, "--"),
        tag: asDisplayText(c.tag || c.classification, "--"),
        score: Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, scoreNum)) : 0,
        summary: asDisplayText(c.summary || c.why, ""),
      };
    });

  const personalisedTreatmentPhases = resolveItems(
    lockedNarrative?.personalisedTreatmentPhases,
    resolvedReport?.personalisedTreatmentPhases
  ).map((p, i) => ({
    phase: asDisplayText(p.phase, `Phase ${i + 1}`),
    monthRange: asDisplayText(p.monthRange, ""),
    subtitle: asDisplayText(p.subtitle, ""),
    tone: p.tone || "cyan",
    icon: p.icon || "shield",
    bullets: asDisplayList(p.bullets),
    fromApi: true
  }));

  const phases = personalisedTreatmentPhases;

  const recommendationRows = resolveItems(resolvedReport?.recommendationRows).map((r, idx) => {
    const tagToneRaw = asDisplayText(r?.tagTone || r?.priorityTone, "recommended").toLowerCase();
    const purposeToneRaw = asDisplayText(r?.purposeTone || r?.markerTone, "purpose-cyan").toLowerCase();
    const thumbClassRaw = asDisplayText(r?.thumbClass, `thumb-${idx + 1}`).toLowerCase();

    const validTagTones = ["high-priority", "recommended", "adjunct"];
    const validPurposeTones = ["purpose-amber", "purpose-cyan", "purpose-gray"];
    const validThumbClasses = ["thumb-1", "thumb-2", "thumb-3", "thumb-4", "thumb-5"];

    return {
      title: asDisplayText(r?.title || r?.productName || r?.name, "Prescribed Treatment"),
      purpose: asDisplayText(r?.purpose, "Clinical Support"),
      purposeTone: validPurposeTones.includes(purposeToneRaw) ? purposeToneRaw : "purpose-cyan",
      desc: asDisplayText(r?.desc || r?.explanation, ""),
      tag: asDisplayText(r?.tag || r?.priority, "Recommended"),
      tagTone: validTagTones.includes(tagToneRaw) ? tagToneRaw : "recommended",
      price: asDisplayText(r?.price, "Contact Clinic"),
      thumbClass: validThumbClasses.includes(thumbClassRaw) ? thumbClassRaw : "thumb-1",
      fromApi: true,
    };
  });

  const healthIndicatorsRaw = resolveItems(
    lockedNarrative?.healthIndicators?.dashboard,
    lockedNarrative?.clinicalDimensions,
    resolvedReport?.clinicalDimensions
  );

  const clinicalDimensions = healthIndicatorsRaw.map(m => {
    let finalTone = m.tone || (m.score > 80 ? "healthy" : m.score > 50 ? "mild" : "high-risk");
    // Normalize colors to CSS classes
    if (finalTone === 'green') finalTone = 'healthy';
    if (finalTone === 'amber') finalTone = 'mild';
    if (finalTone === 'red') finalTone = 'high-risk';

    return {
      title: asDisplayText(m.title || m.name, "Clinical Metric"),
      status: asDisplayText(m.status, ""),
      score: m.score || 0,
      scoreLabel: asDisplayText(m.scoreLabel, `${m.score || 0}/100`),
      note: asDisplayText(m.note || m.meaning, ""),
      tone: finalTone,
      dashArray: m.dashArray || `${(m.score || 0) * 1.63} 163`,
      fromApi: true
    };
  });

  const clinicalDashboardDimensions = resolveItems(resolvedReport?.clinicalDimensions).map((m, idx) => {
    const scoreNum = Number(asDisplayText(m?.score, 0));
    const safeScore = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, scoreNum)) : 0;
    const roundedScore = Math.round(safeScore);
    const statusRaw = asDisplayText(m?.status, "").toLowerCase();

    const toneFromStatus =
      statusRaw.includes("high") || statusRaw.includes("severe")
        ? "high-risk"
        : statusRaw.includes("mild") || statusRaw.includes("moderate")
          ? "mild"
          : statusRaw.includes("low") || statusRaw.includes("healthy") || statusRaw.includes("normal")
            ? "healthy"
            : "";

    const toneRaw = asDisplayText(m?.tone, toneFromStatus).toLowerCase();
    const normalizedTone =
      toneRaw === "high" || toneRaw === "high-risk"
        ? "high-risk"
        : toneRaw === "healthy" || toneRaw === "good" || toneRaw === "low"
          ? "healthy"
          : toneRaw === "mild" || toneRaw === "moderate"
            ? "mild"
            : roundedScore >= 67
              ? "high-risk"
              : roundedScore >= 34
                ? "mild"
                : "healthy";

    const derivedStatus =
      normalizedTone === "high-risk"
        ? "High Risk"
        : normalizedTone === "healthy"
          ? "Low"
          : "Mild";

    return {
      title: asDisplayText(m?.title || m?.name, `Clinical Metric ${idx + 1}`),
      status: asDisplayText(m?.status, derivedStatus),
      tone: normalizedTone,
      score: roundedScore,
      scoreLabel: asDisplayText(m?.scoreLabel, `${roundedScore}/100`),
      note: asDisplayText(m?.note || m?.meaning, ""),
      dashArray: asDisplayText(m?.dashArray, `${(roundedScore * 1.6336).toFixed(2)} 163.36`),
      fromApi: true,
    };
  });

  const deepMetricRows = resolveItems(resolvedReport?.deepMetricRows).map((dm, idx) => {
    const toneRaw = asDisplayText(dm?.tone, "cyan").toLowerCase();
    const validTones = ["cyan", "green", "purple", "amber", "sky"];
    const scoreNum = Number(asDisplayText(dm?.score || dm?.value, 0));
    const progressNum = Number(asDisplayText(dm?.progress, scoreNum));
    const safeScore = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, scoreNum)) : 0;
    const safeProgress = Number.isFinite(progressNum) ? Math.max(0, Math.min(100, progressNum)) : safeScore;

    return {
      title: asDisplayText(dm?.title || dm?.name, `Clinical Metric ${idx + 1}`),
      score: safeScore,
      progress: safeProgress,
      tone: validTones.includes(toneRaw) ? toneRaw : "cyan",
      scoreStand: asDisplayText(dm?.scoreStand || dm?.standing, "Assessment Provided"),
      scoreNote: asDisplayText(dm?.scoreNote || dm?.explanation, ""),
      benchmarkTitle: asDisplayText(dm?.benchmarkTitle, "Clinical Range"),
      benchmarkLines: asDisplayList(dm?.benchmarkLines),
      meaning: asDisplayText(dm?.meaning, ""),
      fromApi: true,
    };
  });

  const regionalZonesSource = resolveItems(resolvedReport?.regionalZones);
  const findZone = (name) => regionalZonesSource.find(z => (z?.name || z?.zoneName || "").toLowerCase().includes(name.toLowerCase())) || {};

  const regionalZones = ["Frontal", "Mid-Scalp", "Crown"].map((zoneName) => {
    const z = findZone(zoneName);
    const percentNum = Number(asDisplayText(z?.percent || z?.coveragePct, 0));

    return {
      name: zoneName,
      percent: Number.isFinite(percentNum) ? Math.max(0, Math.min(100, percentNum)) : 0,
      status: asDisplayText(z?.status, "--"),
      note: asDisplayText(z?.note || z?.summary, ""),
      fromApi: !!z?.name,
    };
  });

  const lifestyleRiskDirectCandidates = [
    lockedNarrative?.lifestyleRiskFactors,
    resolvedReport?.lifestyleRiskFactors,
    resolvedReport?.lifestyleAssessment?.lifestyleRiskFactors,
    resolvedReport?.lifestyleassessment?.lifestyleRiskFactors,
    resolvedReport?.clinicalNarrative?.lifestyleRiskFactors,
    resolvedReport?.analysisResults?.lifestyleRiskFactors,
  ];
  const deepLifestyleRiskItems = findLifestyleItemsDeep(resolvedReport);
  const lifestyleRiskFactorsSource =
    [...lifestyleRiskDirectCandidates.map(getItems), deepLifestyleRiskItems]
      .filter((items) => items.length > 0)
      .sort((a, b) => getLifestyleItemsScore(b) - getLifestyleItemsScore(a))[0] || [];
  const lifestyleRiskFactors = (
    lifestyleRiskFactorsSource.length > 0
      ? lifestyleRiskFactorsSource
      : safeArray(staticNarrative?.lifestyleFactors)
  ).map((l, idx) => {
    const progressRaw = asDisplayText(
      l?.progress ?? l?.progressPct ?? l?.progressPercentage ?? l?.score ?? l?.value,
      "0"
    );
    const progressNum = parseFloat(String(progressRaw).replace(/[^0-9.\-]/g, ""));
    const safeProgress = Number.isFinite(progressNum)
      ? Math.max(0, Math.min(100, progressNum))
      : 0;
    const toneRaw = asDisplayText(l?.tone || l?.impactTone, "").toLowerCase();

    const normalizedTone =
      toneRaw === "high" || toneRaw === "moderate" || toneRaw === "good"
        ? toneRaw
        : toneRaw === "low" || toneRaw === "healthy" || toneRaw === "none"
          ? "good"
          : safeProgress >= 75
            ? "good"
            : safeProgress >= 40
              ? "moderate"
              : "high";

    const fallbackTag =
      normalizedTone === "good"
        ? "Good"
        : normalizedTone === "high"
          ? "High"
          : "Moderate";

    return {
      label: asDisplayText(l?.label || l?.title || l?.factor || l?.name, `Lifestyle Factor ${idx + 1}`),
      tag: asDisplayText(l?.tag || l?.level || l?.status || l?.value, fallbackTag),
      tone: normalizedTone,
      progress: safeProgress,
      fromApi: true
    };
  });

  const nutritionalProtocolSource = fullReport
    ? resolveItems(resolvedReport?.nutritionalProtocolCards, lockedNarrative?.nutritionalProtocolCards)
    : safeArray(staticNarrative?.nutritionalPlan);
  const nutritionalProtocolCards = nutritionalProtocolSource.map(n => ({
    title: asDisplayText(n.title || n.category, "Nutrient"),
    desc: asDisplayText(n.desc || n.description, ""),
    foods: asDisplayList(n.foods || n.items),
    tone: n.tone || "cyan",
    icon: n.icon || "drop",
    dosage: asDisplayText(n.dosage, ""),
    imageType: n.imageType || null,
    fromApi: true
  }));

  const aiAnalysisInsightRowsSource = resolveItems(resolvedReport?.aiAnalysisInsightRows);
  const aiAnalysisInsightRows = (
    aiAnalysisInsightRowsSource.length > 0 ? aiAnalysisInsightRowsSource : safeArray(dseResult?.aiInsights)
  ).map((row, idx) => {
    const toneRaw = asDisplayText(row?.tone, "mild").toLowerCase();
    const iconRaw = asDisplayText(row?.icon || row?.iconType, "hairline").toLowerCase();
    const validTones = ["mild", "significant"];
    const validIcons = ["hairline", "crown", "visibility", "shaft"];

    return {
      title: asDisplayText(row?.title || row?.name, `Insight ${idx + 1}`),
      severity: asDisplayText(row?.severity, "Mild"),
      desc: asDisplayText(row?.desc || row?.summary || row?.explanation, ""),
      icon: validIcons.includes(iconRaw) ? iconRaw : "hairline",
      tone: validTones.includes(toneRaw) ? toneRaw : "mild",
      fromApi: true,
    };
  });

  const aiPhotoMetricCardsSourceCandidates = [
    resolvedReport?.aiPhotoMetricCards,
    resolvedReport?.analysisResults?.aiPhotoMetricCards,
    resolvedReport?.clinicalNarrative?.aiPhotoMetricCards,
    dseResult?.aiPhotoMetricCards,
  ];
  const aiPhotoMetricCardsSource = aiPhotoMetricCardsSourceCandidates.find(
    (candidate) => getItems(candidate).length > 0
  );
  const aiPhotoMetricFallback = safeArray(dseResult?.visualMetrics);
  const aiPhotoMetricCards = (
    getItems(aiPhotoMetricCardsSource).length > 0
      ? getItems(aiPhotoMetricCardsSource)
      : aiPhotoMetricFallback
  ).map((vm, idx) => {
    const progressRaw = asDisplayText(vm?.progress ?? vm?.percent ?? vm?.percentage, "0");
    const progressNum = parseFloat(String(progressRaw).replace(/[^0-9.\-]/g, ""));
    const safeProgress = Number.isFinite(progressNum)
      ? Math.max(0, Math.min(100, progressNum))
      : 0;
    const toneRaw = asDisplayText(vm?.tone, "").toLowerCase();
    const titleText = asDisplayText(vm?.title || vm?.name, `Visual Metric ${idx + 1}`);
    const normalizedTone =
      toneRaw === "accuracy" || toneRaw === "confidence"
        ? toneRaw
        : titleText.toLowerCase().includes("accuracy")
          ? "accuracy"
          : "confidence";

    return {
      title: titleText,
      value: asDisplayText(vm?.value, ""),
      subtitle: asDisplayText(vm?.subtitle || vm?.label, ""),
      progress: safeProgress,
      tone: normalizedTone,
      fromApi: true,
    };
  });

  const normalizeRecoveryLevel = (value) => {
    const text = asDisplayText(value, "").toLowerCase();
    if (!text) return "";
    if (text.includes("excellent")) return "Excellent";
    if (text.includes("good") || text.includes("healthy") || text.includes("recovery")) return "Good";
    if (text.includes("moderate")) return "Moderate";
    if (text.includes("low") || text.includes("high") || text.includes("risk") || text.includes("severe")) return "Low";
    return "";
  };

  const deriveRecoveryLevel = (score, activeLevel, status, scoreLabel) => {
    const fromActive = normalizeRecoveryLevel(activeLevel);
    if (fromActive) return fromActive;
    const fromStatus = normalizeRecoveryLevel(status);
    if (fromStatus) return fromStatus;
    const fromLabel = normalizeRecoveryLevel(scoreLabel);
    if (fromLabel) return fromLabel;

    if (score >= 75) return "Excellent";
    if (score >= 50) return "Good";
    if (score >= 25) return "Moderate";
    return "Low";
  };

  const scalpRecoverySourceRaw = getItems(
    resolvedReport?.scalpRecoveryCards ??
    resolvedReport?.clinicalNarrative?.scalpRecoveryCards ??
    lockedNarrative?.scalpRecoveryCards
  );

  const findScalpCard = (match) => scalpRecoverySourceRaw.find(c =>
    (c?.title || c?.name || "").toLowerCase().includes(match.toLowerCase())
  );

  const scalpRecoveryCards = (
    scalpRecoverySourceRaw.length > 0
      ? ["Scalp Health Risk", "Growth Potential"].map((titleMatch) => {
        const p = findScalpCard(titleMatch);
        const scoreNum = Number(asDisplayText(p?.score, 0));
        const safeScore = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, scoreNum)) : 0;
        const toneRaw = asDisplayText(p?.tone, titleMatch.includes("Growth") ? "cyan" : "amber").toLowerCase();
        const validTones = ["amber", "cyan", "red", "green"];
        return {
          title: p?.title || p?.name || titleMatch,
          score: safeScore,
          scoreLabel: asDisplayText(p?.scoreLabel, `${safeScore}/100`),
          note: asDisplayText(p?.note || p?.meaning, ""),
          tone: validTones.includes(toneRaw) ? toneRaw : (titleMatch.includes("Growth") ? "cyan" : "amber"),
          dashArray: p?.dashArray || `${(safeScore * 2.293).toFixed(2)} ${(229.3 - safeScore * 2.293).toFixed(2)}`,
          levels: Array.isArray(p?.levels) && p.levels.length > 0 ? p.levels : ["Low", "Moderate", "Good", "Excellent"],
          activeLevel: asDisplayText(p?.activeLevel, deriveRecoveryLevel(safeScore, p?.activeLevel, p?.status, p?.scoreLabel)),
          hasFloatBadge: toBooleanFlag(p?.hasFloatBadge, false),
          fromApi: !!p,
        };
      })
      : clinicalDimensions
        .filter(d => d.title === "Recovery" || d.title === "Scalp Health")
        .map((p) => {
          const scoreNum = Number(p?.score || 0);
          const safeScore = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, scoreNum)) : 0;
          return {
            ...p,
            score: safeScore,
            levels: ["Low", "Moderate", "Good", "Excellent"],
            activeLevel: deriveRecoveryLevel(safeScore, p?.activeLevel, p?.status, p?.scoreLabel),
          };
        })
  );

  const getMealDefaults = (mealName) => {
    const name = (mealName || "").toLowerCase();
    if (name.includes("breakfast")) return { tone: "amber", icon: "sun" };
    if (name.includes("lunch")) return { tone: "green", icon: "leaf" };
    if (name.includes("snack")) return { tone: "cyan", icon: "apple" };
    if (name.includes("dinner")) return { tone: "green", icon: "leaf" };
    if (name.includes("supplement")) return { tone: "amber", icon: "chain" };
    return { tone: "cyan", icon: "leaf" };
  };

  const dailyMealPlanSource = fullReport
    ? resolveItems(resolvedReport?.dailyMealPlanRows, lockedNarrative?.dailyMealPlanRows, lockedNarrative?.dailyMealPlan)
    : safeArray(staticNarrative?.dailyMealPlan);
  const dailyMealPlanRows = dailyMealPlanSource.map(m => {
    const mealName = asDisplayText(m.meal || m.type, "Meal");
    const defaults = getMealDefaults(mealName);
    return {
      meal: mealName,
      detail: asDisplayText(m.detail, asDisplayList(m.menu).join(", ")),
      tone: defaults.tone,
      icon: defaults.icon,
      fromApi: true
    };
  });

  const improvementPredictionCards = resolveItems(lockedNarrative?.improvementPredictionCards, resolvedReport?.improvementPredictionCards).map(p => ({
    period: asDisplayText(p.period, "Current"),
    phase: asDisplayText(p.phase, "Assessment"),
    tone: p.tone || "cyan",
    metrics: safeArray(p.metrics).map(m => ({
      label: asDisplayText(m.label, "Metric"),
      value: asDisplayText(m.value, "Calculating"),
      progress: m.progress || 0
    })),
    fromApi: true
  }));


  const treatmentRecommendationSource = resolveItems(
    lockedNarrative?.treatmentRecommendationRows,
    resolvedReport?.treatmentRecommendationRows
  );

  const treatmentRecommendationRows =
    treatmentRecommendationSource.length > 0
      ? treatmentRecommendationSource.map((r) => {
        const priorityTone = asDisplayText(
          r.priorityTone || r.tagTone || r.markerTone,
          "medium"
        ).toLowerCase();
        const markerTone = asDisplayText(
          r.markerTone || r.priorityTone || r.tagTone,
          priorityTone
        ).toLowerCase();

        return {
          title: asDisplayText(r.title || r.name || r.productName, "Treatment"),
          desc: asDisplayText(r.desc || r.explanation, ""),
          priority: asDisplayText(r.priority || r.tag, "MEDIUM"),
          priorityTone,
          markerTone,
          timeFrame: asDisplayText(
            r.timeFrame || r.timeframe || r.window,
            "1-3 mo"
          ),
          duration: asDisplayText(
            r.duration || r.phase || r.purpose || r.goal,
            "Ongoing"
          ),
          showImage: toBooleanFlag(r.showImage, true),
          fromApi: true,
        };
      })
      : recommendationRows.map((r) => ({
        title: asDisplayText(r.title, "Treatment"),
        desc: asDisplayText(r.desc, ""),
        priority: asDisplayText(r.priority, "MEDIUM"),
        priorityTone: asDisplayText(r.priorityTone, "medium").toLowerCase(),
        markerTone: asDisplayText(r.markerTone, "medium").toLowerCase(),
        timeFrame: "1-3 mo",
        duration: asDisplayText(r.purpose, "Ongoing"),
        showImage: true,
        fromApi: true,
      }));

  const foodsToAvoidSource = useStatic
    ? safeArray(staticNarrative?.toAvoid)
    : resolveItems(lockedNarrative?.foodsHabitsToAvoid, resolvedReport?.foodsHabitsToAvoid);
  const foodsHabitsToAvoid = foodsToAvoidSource.map(f => ({
    title: asDisplayText(f.title, "Avoidance Item"),
    explanation: asDisplayText(f.detail || f.explanation, ""),
    tone: f.tone || "warning",
    fromApi: true
  }));

  const dailyRoutineSource = resolveItems(resolvedReport?.dailyRoutineItems);
  const dailyRoutineItems = (
    dailyRoutineSource.length > 0 ? dailyRoutineSource : safeArray(staticNarrative?.dailyRoutine)
  ).map(r => ({
    label: asDisplayText(r?.label, "Routine"),
    action: asDisplayText(r?.action, ""),
    note: asDisplayText(r?.note, ""),
    highlight: toBooleanFlag(r?.highlight, false),
    fromApi: true
  }));

  const weeklyScheduleSource = fullReport
    ? resolveItems(resolvedReport?.weeklyHairSchedule)
    : safeArray(staticNarrative?.weeklySchedule);
  const weeklyHairSchedule = weeklyScheduleSource.map(s => ({
    day: asDisplayText(s?.day, "Day"),
    tasks: asDisplayList(s?.tasks),
    locked: toBooleanFlag(s?.locked, false),
    fromApi: true
  }));

  const weeklyDayLockIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="9"
      viewBox="0 0 10 9"
      fill="none"
    >
      <path
        d="M6.9375 3.1875H7.6875C7.7925 3.1875 7.88125 3.22375 7.95375 3.29625C8.02625 3.36875 8.0625 3.4575 8.0625 3.5625V8.0625C8.0625 8.1675 8.02625 8.25625 7.95375 8.32875C7.88125 8.40125 7.7925 8.4375 7.6875 8.4375H1.6875C1.5825 8.4375 1.49375 8.40125 1.42125 8.32875C1.34875 8.25625 1.3125 8.1675 1.3125 8.0625V3.5625C1.3125 3.4575 1.34875 3.36875 1.42125 3.29625C1.49375 3.22375 1.5825 3.1875 1.6875 3.1875H2.4375V2.8125C2.4375 2.4075 2.54 2.03 2.745 1.68C2.945 1.34 3.215 1.07 3.555 0.87C3.905 0.665 4.2825 0.5625 4.6875 0.5625C5.0925 0.5625 5.47 0.665 5.82 0.87C6.16 1.07 6.43 1.34 6.63 1.68C6.835 2.03 6.9375 2.4075 6.9375 2.8125V3.1875ZM4.3125 6.09V6.9375H5.0625V6.09C5.1775 6.02 5.26875 5.9275 5.33625 5.8125C5.40375 5.6975 5.4375 5.5725 5.4375 5.4375C5.4375 5.3025 5.40375 5.1775 5.33625 5.0625C5.26875 4.9475 5.1775 4.85625 5.0625 4.78875C4.9475 4.72125 4.8225 4.6875 4.6875 4.6875C4.5525 4.6875 4.4275 4.72125 4.3125 4.78875C4.1975 4.85625 4.10625 4.9475 4.03875 5.0625C3.97125 5.1775 3.9375 5.3025 3.9375 5.4375C3.9375 5.5725 3.97125 5.6975 4.03875 5.8125C4.10625 5.9275 4.1975 6.02 4.3125 6.09ZM6.1875 3.1875V2.8125C6.1875 2.5425 6.12 2.2925 5.985 2.0625C5.85 1.8325 5.6675 1.65 5.4375 1.515C5.2075 1.38 4.9575 1.3125 4.6875 1.3125C4.4175 1.3125 4.1675 1.38 3.9375 1.515C3.7075 1.65 3.525 1.8325 3.39 2.0625C3.255 2.2925 3.1875 2.5425 3.1875 2.8125V3.1875H6.1875Z"
        fill="currentColor"
      />
    </svg>
  );

  const stressTechniqueSource = !fullReport
    ? safeArray(staticNarrative?.stressTechniques)
    : resolveItems(
      lockedNarrative?.stressTechniques,
      resolvedReport?.stressReductionTechniques
    );
  const stressReductionTechniques = stressTechniqueSource.map(t => ({
    title: asDisplayText(t.name || t.title, "Technique"),
    desc: asDisplayText(t.explanation || t.desc, ""),
    icon: t.icon,
    impact: asDisplayText(t.impact, ""),
    how: asDisplayText(t.how, ""),
    tone: t.tone || "cyan",
    fromApi: true
  }));

  const cortisolReducingFoods = resolveItems(
    lockedNarrative?.stressFoods,
    resolvedReport?.cortisolReducingFoods
  ).map(f => ({
    title: asDisplayText(f.name || f.title, "Food"),
    desc: asDisplayText(f.explanation || f.desc, ""),
    fromApi: true
  }));

  const predictiveRiskFallbackRows = [
    { label: "Now", untreated: 30, treated: 30 },
    { label: "1 Year", untreated: 45, treated: 22 },
    { label: "5 Years", untreated: 80, treated: 10 },
  ];
  const predictiveRiskSource = resolveItems(resolvedReport?.predictiveRiskRows);
  const predictiveRiskRows = (predictiveRiskSource.length > 0 ? predictiveRiskSource : predictiveRiskFallbackRows).map((r, idx) => {
    const untreatedNum = Number(asDisplayText(r?.untreated, 0));
    const treatedNum = Number(asDisplayText(r?.treated, 0));
    return {
      label: asDisplayText(r?.label, `Period ${idx + 1}`),
      untreated: Number.isFinite(untreatedNum) ? Math.max(0, Math.min(100, untreatedNum)) : 0,
      treated: Number.isFinite(treatedNum) ? Math.max(0, Math.min(100, treatedNum)) : 0,
      fromApi: true,
    };
  });

  const activeRiskFactors = resolveItems(resolvedReport?.activeRiskFactors).map((r, idx) => {
    const toneRaw = asDisplayText(r?.tone, "moderate").toLowerCase();
    const normalizedTone =
      toneRaw === "good" || toneRaw === "low"
        ? "good"
        : toneRaw === "high"
          ? "high"
          : "moderate";

    return {
      label: asDisplayText(r?.label || r?.title || r?.name, `Factor ${idx + 1}`),
      level: asDisplayText(r?.level || r?.severity, "MODERATE"),
      tone: normalizedTone,
      note: asDisplayText(r?.note || r?.detail || r?.description || r?.impact, ""),
      fromApi: true,
    };
  });

  const healthIndicators = safeArray(lockedNarrative?.healthIndicators?.dashboard).map(hi => ({
    title: asDisplayText(hi.title, "Indicator"),
    score: hi.score,
    status: asDisplayText(hi.status, ""),
    note: asDisplayText(hi.note, ""),
    fromApi: true
  }));

  const evidenceTrail = safeArray(lockedNarrative?.evidenceTrail).map(e => ({
    claim: asDisplayText(e.claim, ""),
    sources: asDisplayList(e.sources),
    fromApi: true
  }));

  const prognosisText = asDisplayText(
    lockedNarrative?.prognosis,
    "Clinical prognosis pending."
  );

  const shaftScalpSource = fullReport
    ? resolveItems(resolvedReport?.shaftScalpInsightCards)
    : safeArray(staticDse?.scalpInsights);
  const shaftScalpInsightCards = shaftScalpSource.map((i, idx) => {
    const toneRaw = asDisplayText(i?.tone, "amber").toLowerCase();
    const iconRaw = asDisplayText(i?.icon, "breakage").toLowerCase();
    const validTones = ["amber", "red"];
    const validIcons = ["breakage", "split", "texture", "oiliness"];

    return {
      title: asDisplayText(i?.title || i?.name, `Shaft/Scalp Insight ${idx + 1}`),
      status: asDisplayText(i?.status || i?.label, "Moderate"),
      tone: validTones.includes(toneRaw) ? toneRaw : "amber",
      icon: validIcons.includes(iconRaw) ? iconRaw : "breakage",
      summary: asDisplayText(i?.summary || i?.explanation || i?.desc, ""),
      steps: asDisplayList(i?.steps),
      showImage: toBooleanFlag(i?.showImage, false),
      fromApi: true,
    };
  });

  const freebiesRows = resolveItems(
    lockedDse?.freebies,
    resolvedReport?.freebiesRows
  ).map(f => ({
    title: asDisplayText(f.name || f.title, "Freebie"),
    desc: asDisplayText(f.explanation || f.desc, ""),
    fromApi: true
  }));

  const bloodInvestigationCards = resolveItems(
    lockedNarrative?.bloodInvestigationCards,
    resolvedReport?.bloodInvestigationCards
  ).map(b => ({
    title: asDisplayText(b.title || b.name, "Investigation"),
    desc: asDisplayText(b.desc || b.explanation, ""),
    status: asDisplayText(b.status, "Recommended"),
    tone: b.tone || "cyan",
    icon: b.icon || "tsh",
    fromApi: true
  }));

  const getAdditionalFactorTone = (tag) => {
    const normalizedTag = (tag || "").toLowerCase();
    if (normalizedTag === "contributing") return "cyan";
    if (normalizedTag === "minor") return "amber";
    if (normalizedTag === "low" || normalizedTag === "primary cause") return "red";
    return "cyan";
  };

  const getClinicalNumberToneClass = (value) => {
    if (!Number.isFinite(value)) return "clinical-summary-accent-amber";
    if (value >= 70) return "clinical-summary-accent-green";
    if (value >= 40) return "clinical-summary-accent-amber";
    return "clinical-summary-accent-red";
  };

  const renderClinicalSummaryWithHighlights = (text) => {
    const safeText = asDisplayText(text, "");
    const tokenPattern = /(\d+(?:\.\d+)?|[%/\-–+])/g;

    return safeText.split(tokenPattern).map((part, idx) => {
      if (/^\d+(?:\.\d+)?$/.test(part)) {
        const numericValue = Number.parseFloat(part);
        const toneClass = getClinicalNumberToneClass(numericValue);

        return (
          <span key={`clinical-num-${idx}-${part}`} className={`clinical-summary-number ${toneClass}`}>
            {part}
          </span>
        );
      }

      if (/^[%/\-–+]$/.test(part)) {
        return (
          <span key={`clinical-symbol-${idx}-${part}`} className="clinical-summary-symbol">
            {part}
          </span>
        );
      }

      return part;
    });
  };



  const clinicalSummaryApiSource =
    resolvedReport?.clinicalSummary && typeof resolvedReport?.clinicalSummary === "object"
      ? resolvedReport.clinicalSummary
      : resolvedReport?.clinicalsummary && typeof resolvedReport?.clinicalsummary === "object"
        ? resolvedReport.clinicalsummary
        : {};
  const clinicalSummaryPrimaryKeys = ["assessment", "hhiSection", "causalFactor", "recoverySection"];
  const clinicalSummaryFromApi = clinicalSummaryPrimaryKeys
    .map((key) => asDisplayText(clinicalSummaryApiSource?.[key], ""))
    .filter((line) => !!line);
  const clinicalSummaryExtraFromApi = Object.entries(clinicalSummaryApiSource)
    .filter(([key]) => !clinicalSummaryPrimaryKeys.includes(key))
    .map(([, value]) => asDisplayText(value, ""))
    .filter((line) => !!line);
  const clinicalSummaryLines =
    clinicalSummaryFromApi.length > 0 || clinicalSummaryExtraFromApi.length > 0
      ? [...clinicalSummaryFromApi, ...clinicalSummaryExtraFromApi]
      : [
        asDisplayText(
          resolvedReport?.clinicalSummary?.assessment ??
          resolvedReport?.clinicalsummary?.assessment,
          `The provisional assessment is ${dseResult?.trichologicalTitle || dseResult?.primaryCondition || "Male Pattern Baldness"
          } - ${dseResult?.staging || "Norwood Stage II"
          }, classified under ${asDisplayText(
            dseResult?.categoryTitle || clinicalNarrative?.categoryTitle,
            "Category 1 - Androgenetic Alopecia (Pattern Baldness)"
          )}, staged as ${dseResult?.staging || "Norwood Stage II"
          } - confirmatory trichoscopy and lab tests required.`
        ),
        asDisplayText(
          resolvedReport?.clinicalSummary?.hhiSection ??
          resolvedReport?.clinicalsummary?.hhiSection,
          `Your Hair Health Index of ${dseResult?.hhi || dseResult?.hairHealthIndex || 72}/100 indicates ${dseResult?.hhiLabel || dseResult?.severity || "generally healthy"
          } hair requiring ${dseResult?.severity === "OPTIMAL" ? "preventive" : "active"
          } monitoring.`
        ),
        asDisplayText(
          resolvedReport?.clinicalSummary?.causalFactor ??
          resolvedReport?.clinicalsummary?.causalFactor,
          `The AI engine identifies ${asDisplayText(
            clinicalNarrative?.probableDiagnosis?.[0]?.name,
            dseResult?.trichologicalTitle || dseResult?.primaryCondition || "Genetic / Androgenetic"
          )} as the primary causal factor (${Number(
            asDisplayText(clinicalNarrative?.probableDiagnosis?.[0]?.probabilityPct, dseResult?.probabilityPct || 61)
          )}% probability), with ${asDisplayText(
            clinicalNarrative?.probableDiagnosis?.[1]?.name,
            "Stress-Induced (Telogen)"
          )} as a secondary contributor (${Number(
            asDisplayText(clinicalNarrative?.probableDiagnosis?.[1]?.probabilityPct, 39)
          )}%).`
        ),
        asDisplayText(
          resolvedReport?.clinicalSummary?.recoverySection ??
          resolvedReport?.clinicalsummary?.recoverySection,
          `Recovery potential score: ${dseResult?.treatmentResponsiveness || 84}/100 - ${dseResult?.treatmentResponsiveness >= 70
            ? "favourable"
            : dseResult?.treatmentResponsiveness >= 40
              ? "guarded"
              : "poor"
          } prognosis with consistent treatment adherence over 6-12 months.`
        ),
      ];

  const handleRetakeDiagnostic = () => {
    router.push("/hair-test-assessment");
  };

  const handleGoToPhotoUpload = () => {
    const targetSessionId =
      resolvedSessionId ||
      sessionId ||
      resolvedReport?.sessionId ||
      resolvedReport?.hairTestId ||
      resolvedReport?.id ||
      localStorage.getItem('hair_assessment_session_id');

    if (targetSessionId) {
      localStorage.setItem('hair_assessment_session_id', String(targetSessionId));
    }

    // Open AI intro section: "Improve Your Diagnosis with AI Photo Analysis"
    router.push("/take-hair-test-premium?focus=photo-analysis");
  };

  const showReportSkeleton = (loading || isReportDataLoading) && !reportData;

  return (
    <>
      <header className="report-main-header container">
        <div className="header-top-row">
          <div className="header-left-group">
            <button
              type="button"
              className="back-link-btn"
              aria-label="Back"
              onClick={() => router.back()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"></path>
              </svg>
              <span>Back</span>
            </button>
            <img src="/reportlogo.png" alt="HairSnCare" className="report-logo-img" />
          </div>

          <div className="header-center-group">
            <span className="top-chip">
              <span className="dot-marker-cyan" />
              Hair Intelligence Report
            </span>
          </div>

          <div className="header-right-group">
            <button
              type="button"
              className="download-report-btn desktop-only"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>{isDownloading ? 'Downloading...' : 'Download Report'}</span>
            </button>
          </div>
        </div>

        <div className="header-bottom-meta">
          <div className="meta-left-group">
            <span className="status-badge-highlight">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
              AI Diagnostic Complete
            </span>
            <span className="meta-date-chip">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Generated: {reportData?.createdAt ? new Date(reportData.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "Mar 31, 2026"}
            </span>
          </div>
          <div className="meta-right-group">
            <button
              type="button"
              className="mobile-download-square-btn"
              aria-label="Download PDF"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <span className="report-id-chip desktop-only">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
              </svg>
              Report ID: {resolvedSessionId?.split('-')[0]?.toUpperCase() || "TS-2026-A483921"}
            </span>
          </div>
        </div>
      </header>

      <section className="test-report-page container">
        {showReportSkeleton && (
          <div className="report-skeleton-overlay" aria-live="polite" aria-busy="true">
            <div className="report-skeleton-row"></div>
            <div className="report-skeleton-row short"></div>
            <div className="report-skeleton-card-grid">
              <div className="report-skeleton-card"></div>
              <div className="report-skeleton-card"></div>
              <div className="report-skeleton-card"></div>
            </div>
            <div className="report-skeleton-block"></div>
          </div>
        )}
        <div className="report-content-grid" style={showReportSkeleton ? { visibility: "hidden" } : undefined}>
        <div className="left-report-column">
          {/* Section: report summary */}
          <article className="report-diagnostic-panel">
            <div className="diagnostic-header-section">
              <div className="report-identity-row">
                <div className="id-icon-wrap">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4.37352 1.45834V2.625H3.20727V4.95834C3.20727 5.37834 3.31223 5.76723 3.52215 6.12501C3.73208 6.48278 4.01587 6.76667 4.37352 6.97667C4.73117 7.18667 5.11992 7.29167 5.53977 7.29167C5.95962 7.29167 6.34837 7.18667 6.70602 6.97667C7.06367 6.76667 7.34745 6.48278 7.55738 6.12501C7.7673 5.76723 7.87227 5.37834 7.87227 4.95834V2.625H6.70602V1.45834H8.45539C8.61867 1.45834 8.75667 1.51473 8.86941 1.62751C8.98215 1.74028 9.03852 1.87834 9.03852 2.04167V4.95834C9.03852 5.52612 8.91023 6.05889 8.65365 6.55667C8.40485 7.04667 8.05692 7.45501 7.60986 7.78167C7.1628 8.10834 6.66714 8.31834 6.12289 8.41167V9.33334C6.12289 9.70667 6.21425 10.0489 6.39696 10.36C6.57967 10.6711 6.82653 10.9181 7.13753 11.1008C7.44853 11.2836 7.79063 11.375 8.16383 11.375C8.59145 11.375 8.9802 11.2525 9.33008 11.0075C9.67995 10.7625 9.92875 10.4456 10.0765 10.0567C9.76548 9.91667 9.51473 9.70278 9.32425 9.415C9.13376 9.12723 9.03852 8.80834 9.03852 8.45834C9.03852 8.13945 9.11627 7.84584 9.27177 7.57751C9.42727 7.30917 9.63913 7.09723 9.90737 6.94167C10.1756 6.78612 10.4691 6.70834 10.7879 6.70834C11.1067 6.70834 11.4002 6.78612 11.6684 6.94167C11.9366 7.09723 12.1485 7.30917 12.304 7.57751C12.4595 7.84584 12.5373 8.13945 12.5373 8.45834C12.5373 8.85501 12.4187 9.20889 12.1816 9.52C11.9444 9.83112 11.6393 10.0372 11.2661 10.1383C11.1494 10.5972 10.9395 11.0094 10.6363 11.375C10.3331 11.7406 9.96763 12.0264 9.54 12.2325C9.11238 12.4386 8.65365 12.5417 8.16383 12.5417C7.5807 12.5417 7.04423 12.3978 6.5544 12.11C6.06458 11.8222 5.67583 11.4333 5.38815 10.9433C5.10048 10.4533 4.95664 9.91667 4.95664 9.33334V8.41167C4.41239 8.31834 3.91673 8.10834 3.46967 7.78167C3.02261 7.45501 2.67468 7.04667 2.42588 6.55667C2.1693 6.05889 2.04102 5.52612 2.04102 4.95834V2.04167C2.04102 1.87834 2.09738 1.74028 2.21012 1.62751C2.32286 1.51473 2.46087 1.45834 2.62414 1.45834H4.37352ZM10.7879 7.87501C10.6246 7.87501 10.4866 7.93139 10.3739 8.04417C10.2611 8.15695 10.2048 8.295 10.2048 8.45834C10.2048 8.62167 10.2611 8.75973 10.3739 8.87251C10.4866 8.98528 10.6246 9.04167 10.7879 9.04167C10.9512 9.04167 11.0892 8.98528 11.2019 8.87251C11.3146 8.75973 11.371 8.62167 11.371 8.45834C11.371 8.295 11.3146 8.15695 11.2019 8.04417C11.0892 7.93139 10.9512 7.87501 10.7879 7.87501Z"
                      fill="#00E5FF"
                    />
                  </svg>
                </div>
                <span className="report-series-title">Diagnostic Report — Hair</span>
              </div>
              <span className="questionnaire-pill">
                <span className="dot-marker-cyan" />
                Questionnaire Report
              </span>
            </div>

            <div className="diagnostic-status-grid">
              <div className="status-pills-wrap">
                <span className="clinician-pill success-tone">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Assessment Complete
                </span>
                <span className="clinician-pill dark-tone">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  ID: {resolvedSessionId?.split('-')[0]?.toUpperCase() || "TS-2026-A483921"}
                </span>
              </div>
              <div className="date-pill-wrap">
                <span className="clinician-pill dark-tone">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="18"
                      rx="2"
                      ry="2"
                    ></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  {reportData?.createdAt ? new Date(reportData.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "Mar 31, 2026"}
                </span>
              </div>
            </div>

            <div className="clinical-hero-copy">
              <div className="clinical-hero-content">
                <h1 className="report-main-heading">Hair Intelligence Report</h1>
                <p className="report-summary-text">
                  {clinicalSummaryText}
                </p>
                {clinicalSummaryConfidence && (
                  <p className="report-confidence-text" style={{ marginTop: '8px', fontSize: '12px', color: '#10B981', fontWeight: 600 }}>
                    Confidence: {clinicalSummaryConfidence}
                  </p>
                )}
                {clinicalNarrative?.prognosis && (
                  <p className="report-prognosis-text" style={{ marginTop: '10px', fontSize: '14px', color: '#00E5FF', fontStyle: 'italic' }}>
                    <strong>Prognosis:</strong> {typeof clinicalNarrative.prognosis === 'string' ? clinicalNarrative.prognosis : (clinicalNarrative.prognosis?.summary || "Favourable recovery potential with adherence to protocol.")}
                  </p>
                )}
                <p className="report-disclaimer-text" style={{ marginTop: '12px', fontSize: '11px', opacity: 0.6 }}>
                  {asDisplayText(clinicalNarrative?.disclaimer, "This is not a medical diagnosis — consult a qualified trichologist for clinical confirmation.")}
                </p>
              </div>
            </div>

            <div className="diagnostic-insight-stack">
              {/* Category Card */}
              <article className="clinical-insight-card amber-theme">
                <div className="card-top-label">
                  <svg
                    width="13"
                    height="16"
                    viewBox="0 0 13 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2.25 2.81004H10.25C10.39 2.81004 10.5083 2.85837 10.605 2.95504C10.7017 3.05171 10.75 3.17004 10.75 3.31004V12.94C10.75 13.0134 10.725 13.0734 10.675 13.12C10.625 13.1667 10.5667 13.19 10.5 13.19C10.4667 13.19 10.4333 13.1834 10.4 13.17L6.25 11.32L2.1 13.17C2.04 13.1967 1.97667 13.1984 1.91 13.175C1.84333 13.1517 1.79667 13.11 1.77 13.05C1.75667 13.0167 1.75 12.98 1.75 12.94V3.31004C1.75 3.17004 1.79833 3.05171 1.895 2.95504C1.99167 2.85837 2.11 2.81004 2.25 2.81004ZM9.75 11.79V3.81004H2.75V11.79L6.25 10.23L9.75 11.79ZM6.25 8.56004L4.78 9.33004L5.06 7.69004L3.87 6.53004L5.52 6.29004L6.25 4.81004L6.98 6.29004L8.63 6.53004L7.44 7.69004L7.72 9.33004L6.25 8.56004Z"
                      fill="#F4C430"
                    />
                  </svg>
                  Assessment Category
                </div>
                <h3 className="card-main-title">
                  {asDisplayText(dseResult?.categoryTitle || clinicalNarrative?.classification || clinicalNarrative?.conditions?.[0]?.name, "Assessment Complete")}
                </h3>
                <div className="card-footer-note">Alopecia Classification</div>
              </article>

              {/* Trichological Card */}
              <article className="clinical-insight-card cyan-theme">
                <div className="card-top-label">
                  <svg
                    width="13"
                    height="17"
                    viewBox="0 0 13 17"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3.8 9.61C4.08 9.71667 4.30833 9.89667 4.485 10.15C4.66167 10.4033 4.75 10.6867 4.75 11C4.75 11.2733 4.68333 11.525 4.55 11.755C4.41667 11.985 4.235 12.1667 4.005 12.3C3.775 12.4333 3.52333 12.5 3.25 12.5C2.97667 12.5 2.725 12.4333 2.495 12.3C2.265 12.1667 2.08333 11.985 1.95 11.755C1.81667 11.525 1.75 11.2733 1.75 11C1.75 10.68 1.84333 10.39 2.03 10.13C2.21667 9.87 2.45667 9.69 2.75 9.59V6.41C2.45667 6.31 2.21667 6.13 2.03 5.87C1.84333 5.61 1.75 5.32 1.75 5C1.75 4.72667 1.81667 4.475 1.95 4.245C2.08333 4.015 2.265 3.83333 2.495 3.7C2.725 3.56667 2.97667 3.5 3.25 3.5C3.52333 3.5 3.775 3.56667 4.005 3.7C4.235 3.83333 4.41667 4.015 4.55 4.245C4.68333 4.475 4.75 4.72667 4.75 5C4.75 5.32 4.65667 5.61 4.47 5.87C4.28333 6.13 4.04333 6.31 3.75 6.41V8C3.96333 7.84 4.19667 7.71667 4.45 7.63C4.70333 7.54333 4.97 7.5 5.25 7.5H7.25C7.59 7.5 7.895 7.39667 8.165 7.19C8.435 6.98333 8.61333 6.71667 8.7 6.39C8.42 6.28333 8.19167 6.10333 8.015 5.85C7.83833 5.59667 7.75 5.31333 7.75 5C7.75 4.72667 7.81667 4.475 7.95 4.245C8.08333 4.015 8.265 3.83333 8.495 3.7C8.725 3.56667 8.97667 3.5 9.25 3.5C9.52333 3.5 9.775 3.56667 10.005 3.7C10.235 3.83333 10.4167 4.015 10.55 4.245C10.6833 4.475 10.75 4.72667 10.75 5C10.75 5.32667 10.6533 5.62167 10.46 5.885C10.2667 6.14833 10.0167 6.33 9.71 6.43C9.64333 6.81667 9.49333 7.16833 9.26 7.485C9.02667 7.80167 8.735 8.05 8.385 8.23C8.035 8.41 7.65667 8.5 7.25 8.5H5.25C4.91 8.5 4.605 8.60333 4.335 8.81C4.065 9.01667 3.88667 9.28333 3.8 9.61ZM3.25 10.5C3.11 10.5 2.99167 10.5483 2.895 10.645C2.79833 10.7417 2.75 10.86 2.75 11C2.75 11.14 2.79833 11.2583 2.895 11.355C2.99167 11.4517 3.11 11.5 3.25 11.5C3.39 11.5 3.50833 11.4517 3.605 11.355C3.70167 11.2583 3.75 11.14 3.75 11C3.75 10.86 3.70167 10.7417 3.605 10.645C3.50833 10.5483 3.39 10.5 3.25 10.5ZM3.25 4.5C3.11 4.5 2.99167 4.54833 2.895 4.645C2.79833 4.74167 2.75 4.86 2.75 5C2.75 5.14 2.79833 5.25833 2.895 5.355C2.99167 5.45167 3.11 5.5 3.25 5.5C3.39 5.5 3.50833 5.45167 3.605 5.355C3.70167 5.25833 3.75 5.14 3.75 5C3.75 4.86 3.70167 4.74167 3.605 4.645C3.50833 4.54833 3.39 4.5 3.25 4.5ZM9.25 4.5C9.11 4.5 8.99167 4.54833 8.895 4.645C8.79833 4.74167 8.75 4.86 8.75 5C8.75 5.14 8.79833 5.25833 8.895 5.355C8.99167 5.45167 9.11 5.5 9.25 5.5C9.39 5.5 9.50833 5.45167 9.605 5.355C9.70167 5.25833 9.75 5.14 9.75 5C9.75 4.86 9.70167 4.74167 9.605 4.645C9.50833 4.54833 9.39 4.5 9.25 4.5Z"
                      fill="#00E5FF"
                    />
                  </svg>
                  Trichological Assessment
                </div>
                <h3 className="card-main-title">
                  {asDisplayText(dseResult?.trichologicalTitle || primaryCauses?.[0]?.title || clinicalNarrative?.conditions?.[0]?.name, "Analysis Complete")}
                </h3>
                <div className="card-footer-note note-highlight">
                  <span className="dot-marker" />
                  Primary Finding
                </div>
              </article>

              {/* Risk Card */}
              <article className="clinical-insight-card green-theme">
                <div className="card-top-label">
                  <svg
                    width="13"
                    height="16"
                    viewBox="0 0 13 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g clipPath="url(#clip0_335_10056)">
                      <path
                        d="M6.25 2.5L10.36 3.41C10.4733 3.43667 10.5667 3.49667 10.64 3.59C10.7133 3.68333 10.75 3.78667 10.75 3.9V8.89C10.75 9.39667 10.6317 9.87 10.395 10.31C10.1583 10.75 9.83 11.11 9.41 11.39L6.25 13.5L3.09 11.39C2.67 11.11 2.34167 10.75 2.105 10.31C1.86833 9.87 1.75 9.39667 1.75 8.89V3.9C1.75 3.78667 1.78667 3.68333 1.86 3.59C1.93333 3.49667 2.02667 3.43667 2.14 3.41L6.25 2.5ZM6.25 3.52L2.75 4.3V8.89C2.75 9.23 2.82833 9.54667 2.985 9.84C3.14167 10.1333 3.36 10.3733 3.64 10.56L6.25 12.3L8.86 10.56C9.14 10.3733 9.35833 10.1333 9.515 9.84C9.67167 9.54667 9.75 9.23 9.75 8.89V4.3L6.25 3.52ZM8.48 6.11L9.18 6.82L6 10L3.88 7.88L4.59 7.17L6 8.59L8.48 6.11Z"
                        fill="#10B981"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_335_10056">
                        <rect
                          width="12.5"
                          height="12"
                          fill="white"
                          transform="translate(0 2)"
                        />
                      </clipPath>
                    </defs>
                  </svg>
                  Risk Level
                </div>
                <h3 className="card-main-title">{dseResult?.riskLevelLabel || dseResult?.severity || "Low Risk"}</h3>
                <div className="risk-scale-row">
                  <div className="risk-progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${dseResult?.riskScore || dseResult?.hairLossRiskScore || (100 - (dseResult?.hhi || 78))}%` }}
                    ></div>
                  </div>
                  <span className="risk-value-text">{dseResult?.riskScore || dseResult?.hairLossRiskScore || (100 - (dseResult?.hhi || 78))} / 100</span>
                </div>
                <div className="card-footer-note">Progressive Loss Risk</div>
              </article>
            </div>
          </article>

          {/* Section: medical verification */}
          <article className="medical-review-card">
            <div className="medical-card-head">
              <span className="medical-card-head-left">
                <span className="medical-head-icon" aria-hidden="true">
                  <svg
                    width="15"
                    height="14"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7.28902 0.583354L12.0823 1.64502C12.2145 1.67613 12.3233 1.74613 12.4089 1.85502C12.4944 1.96391 12.5371 2.08447 12.5371 2.21669V8.03835C12.5371 8.62946 12.3991 9.18169 12.1231 9.69502C11.8471 10.2084 11.4642 10.6284 10.9744 10.955L7.28902 13.4167L3.60367 10.955C3.11384 10.6284 2.73092 10.2084 2.45491 9.69502C2.1789 9.18169 2.04089 8.62946 2.04089 8.03835V2.21669C2.04089 2.08447 2.08366 1.96391 2.16918 1.85502C2.25471 1.74613 2.36356 1.67613 2.49573 1.64502L7.28902 0.583354ZM9.88976 4.79502L6.99746 7.68835L5.35304 6.03169L4.52501 6.86002L6.99746 9.33335L10.7061 5.62335L9.88976 4.79502Z"
                      fill="#10B981"
                    />
                  </svg>
                </span>
                <span className="verification-label-text">
                  Medical Review & Verification
                </span>
              </span>
              <span className="verified-pill">
                <span className="verified-pill-dot" aria-hidden="true" />
                Medically Reviewed & Verified
              </span>
            </div>
            <div className="medical-card-body">
              <div className="doctor-side">
                <div className="doctor-photo-wrap">
                  <div className="doctor-photo" />
                  <span className="doctor-online-dot">
                    {" "}
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 1C18.0751 1 23 5.92487 23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12C1 5.92487 5.92487 1 12 1Z"
                        fill="#10B981"
                      />
                      <path
                        d="M12 1C18.0751 1 23 5.92487 23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12C1 5.92487 5.92487 1 12 1Z"
                        stroke="#061A2E"
                        strokeWidth="2"
                      />
                      <path
                        d="M11.1098 13.325L14.9393 9.49169L15.522 10.0834L11.1098 14.5084L8.4624 11.85L9.04515 11.2667L11.1098 13.325Z"
                        fill="white"
                      />
                    </svg>
                  </span>
                </div>
                <h4>Dr. Amit Sharma</h4>
                <p className="doctor-role">MD Dermatology</p>
                <p className="doctor-cert">Certified Trichologist</p>
              </div>
              <div className="review-side">
                <h5>
                  <span className="review-title-icon" aria-hidden="true">
                    <svg
                      width="13"
                      height="12"
                      viewBox="0 0 13 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8.75 7.71993V11.1499C8.75 11.2233 8.725 11.2833 8.675 11.3299C8.625 11.3766 8.56667 11.3999 8.5 11.3999C8.45333 11.3999 8.41 11.3899 8.37 11.3699L6.25 10.0999L4.13 11.3699C4.07 11.4033 4.00667 11.4116 3.94 11.3949C3.87333 11.3783 3.82333 11.3399 3.79 11.2799C3.76333 11.2399 3.75 11.1966 3.75 11.1499V7.71993C3.28333 7.34659 2.92 6.89326 2.66 6.35993C2.38667 5.80659 2.25 5.21993 2.25 4.59993C2.25 3.87326 2.43333 3.19993 2.8 2.57993C3.15333 1.97326 3.63 1.49326 4.23 1.13993C4.85 0.779925 5.52333 0.599926 6.25 0.599926C6.97667 0.599926 7.65 0.779925 8.27 1.13993C8.87 1.49326 9.34667 1.97326 9.7 2.57993C10.0667 3.19993 10.25 3.87326 10.25 4.59993C10.25 5.21993 10.1133 5.80659 9.84 6.35993C9.58 6.89326 9.21667 7.34659 8.75 7.71993ZM6.25 7.59993C6.79 7.59993 7.29333 7.46326 7.76 7.18993C8.21333 6.92326 8.57333 6.56326 8.84 6.10993C9.11333 5.64326 9.25 5.13826 9.25 4.59493C9.25 4.05159 9.11333 3.54659 8.84 3.07993C8.57333 2.62659 8.21333 2.26993 7.76 2.00993C7.29333 1.73659 6.79 1.59993 6.25 1.59993C5.71 1.59993 5.20667 1.73659 4.74 2.00993C4.28667 2.26993 3.92667 2.62659 3.66 3.07993C3.38667 3.54659 3.25 4.05159 3.25 4.59493C3.25 5.13826 3.38667 5.64326 3.66 6.10993C3.92667 6.56326 4.28667 6.92326 4.74 7.18993C5.20667 7.46326 5.71 7.59993 6.25 7.59993ZM6.25 6.59993C5.89 6.59993 5.55667 6.50993 5.25 6.32993C4.94333 6.14993 4.7 5.90659 4.52 5.59993C4.34 5.29326 4.25 4.95826 4.25 4.59493C4.25 4.23159 4.34 3.89659 4.52 3.58993C4.7 3.28326 4.94333 3.04159 5.25 2.86493C5.55667 2.68826 5.89 2.59993 6.25 2.59993C6.61 2.59993 6.94333 2.68826 7.25 2.86493C7.55667 3.04159 7.8 3.28326 7.98 3.58993C8.16 3.89659 8.25 4.23159 8.25 4.59493C8.25 4.95826 8.16 5.29326 7.98 5.59993C7.8 5.90659 7.55667 6.14993 7.25 6.32993C6.94333 6.50993 6.61 6.59993 6.25 6.59993Z"
                        fill="#F4C430"
                      />
                    </svg>
                  </span>
                  15+ Years Experience in Hair & Scalp Disorders
                </h5>
                <p className="review-body-copy">
                  This assessment report is programmatically generated using
                  advanced AI algorithms and has been thoroughly validated by
                  certified trichologists and dermatologists to ensure clinical
                  accuracy and treatment relevance. All findings are carefully
                  cross-referenced with established dermatological literature
                  and evidence-based medical guidelines to maintain the highest
                  standards of reliability and precision.
                </p>
                <div className="review-stats-row">
                  <div className="review-stat-box">
                    <div className="review-stat-icon" aria-hidden="true">
                      <svg
                        width="17"
                        height="16"
                        viewBox="0 0 17 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M4.99691 1.66665V2.99998H3.66441V5.66665C3.66441 6.14665 3.78433 6.59109 4.02418 6.99998C4.26403 7.40887 4.58828 7.73331 4.99691 7.97331C5.40554 8.21331 5.84971 8.33331 6.32941 8.33331C6.80911 8.33331 7.25328 8.21331 7.66191 7.97331C8.07054 7.73331 8.39478 7.40887 8.63463 6.99998C8.87448 6.59109 8.99441 6.14665 8.99441 5.66665V2.99998H7.66191V1.66665H9.66066C9.84721 1.66665 10.0049 1.73109 10.1337 1.85998C10.2625 1.98887 10.3269 2.14665 10.3269 2.33331V5.66665C10.3269 6.31553 10.1803 6.92442 9.88718 7.49331C9.60292 8.05331 9.20539 8.51998 8.6946 8.89331C8.1838 9.26665 7.61749 9.50665 6.99566 9.61331V10.6666C6.99566 11.0933 7.10004 11.4844 7.3088 11.84C7.51756 12.1955 7.7996 12.4778 8.15493 12.6866C8.51027 12.8955 8.90113 13 9.32753 13C9.81612 13 10.2603 12.86 10.66 12.58C11.0598 12.3 11.3441 11.9378 11.5128 11.4933C11.1575 11.3333 10.871 11.0889 10.6534 10.76C10.4357 10.4311 10.3269 10.0666 10.3269 9.66665C10.3269 9.3022 10.4157 8.96665 10.5934 8.65998C10.7711 8.35331 11.0131 8.11109 11.3196 7.93331C11.6261 7.75554 11.9614 7.66665 12.3257 7.66665C12.6899 7.66665 13.0252 7.75554 13.3317 7.93331C13.6382 8.11109 13.8802 8.35331 14.0579 8.65998C14.2356 8.96665 14.3244 9.3022 14.3244 9.66665C14.3244 10.12 14.1889 10.5244 13.918 10.88C13.6471 11.2355 13.2984 11.4711 12.872 11.5866C12.7387 12.1111 12.4989 12.5822 12.1524 13C11.806 13.4178 11.3885 13.7444 10.8999 13.98C10.4113 14.2155 9.88718 14.3333 9.32753 14.3333C8.66128 14.3333 8.04833 14.1689 7.48868 13.84C6.92903 13.5111 6.48487 13.0666 6.15618 12.5066C5.8275 11.9466 5.66316 11.3333 5.66316 10.6666V9.61331C5.04133 9.50665 4.47501 9.26665 3.96422 8.89331C3.45343 8.51998 3.0559 8.05331 2.77163 7.49331C2.47848 6.92442 2.33191 6.31553 2.33191 5.66665V2.33331C2.33191 2.14665 2.39631 1.98887 2.52512 1.85998C2.65393 1.73109 2.81161 1.66665 2.99816 1.66665H4.99691ZM12.3257 8.99998C12.1391 8.99998 11.9814 9.06442 11.8526 9.19331C11.7238 9.3222 11.6594 9.47998 11.6594 9.66665C11.6594 9.85331 11.7238 10.0111 11.8526 10.14C11.9814 10.2689 12.1391 10.3333 12.3257 10.3333C12.5122 10.3333 12.6699 10.2689 12.7987 10.14C12.9275 10.0111 12.9919 9.85331 12.9919 9.66665C12.9919 9.47998 12.9275 9.3222 12.7987 9.19331C12.6699 9.06442 12.5122 8.99998 12.3257 8.99998Z"
                          fill="#00E5FF"
                        />
                      </svg>
                    </div>
                    <div>
                      <strong>2,400+</strong>
                      <span>Cases Reviewed</span>
                    </div>
                  </div>
                  <div className="review-stat-box">
                    <div className="review-stat-icon" aria-hidden="true">
                      <svg
                        width="17"
                        height="16"
                        viewBox="0 0 17 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M8.32803 14.6667C7.42193 14.6667 6.5558 14.4934 5.72965 14.1467C4.93904 13.8089 4.23503 13.3311 3.61764 12.7134C3.00025 12.0956 2.52277 11.3911 2.1852 10.6C1.83875 9.77335 1.66553 8.90669 1.66553 8.00002C1.66553 7.09335 1.83875 6.22669 2.1852 5.40002C2.52277 4.60891 3.00025 3.90447 3.61764 3.28669C4.23503 2.66891 4.93904 2.19113 5.72965 1.85335C6.5558 1.50669 7.42193 1.33335 8.32803 1.33335C9.23413 1.33335 10.1003 1.50669 10.9264 1.85335C11.717 2.19113 12.421 2.66891 13.0384 3.28669C13.6558 3.90447 14.1333 4.60891 14.4709 5.40002C14.8173 6.22669 14.9905 7.09335 14.9905 8.00002C14.9905 8.90669 14.8173 9.77335 14.4709 10.6C14.1333 11.3911 13.6558 12.0956 13.0384 12.7134C12.421 13.3311 11.717 13.8089 10.9264 14.1467C10.1003 14.4934 9.23413 14.6667 8.32803 14.6667ZM8.32803 13.3334C9.29631 13.3334 10.1935 13.0889 11.0197 12.6C11.8192 12.1289 12.4543 11.4934 12.9252 10.6934C13.4137 9.86669 13.658 8.96891 13.658 8.00002C13.658 7.03113 13.4137 6.13335 12.9252 5.30669C12.4543 4.50669 11.8192 3.87113 11.0197 3.40002C10.1935 2.91113 9.29631 2.66669 8.32803 2.66669C7.35974 2.66669 6.46253 2.91113 5.63638 3.40002C4.83688 3.87113 4.20172 4.50669 3.7309 5.30669C3.24232 6.13335 2.99803 7.03113 2.99803 8.00002C2.99803 8.96891 3.24232 9.86669 3.7309 10.6934C4.20172 11.4934 4.83688 12.1289 5.63638 12.6C6.46253 13.0889 7.35974 13.3334 8.32803 13.3334ZM8.99428 8.00002H11.6593V9.33335H7.66178V4.66669H8.99428V8.00002Z"
                          fill="#00E5FF"
                        />
                      </svg>
                    </div>
                    <div>
                      <strong>15+</strong>
                      <span>Years Experience</span>
                    </div>
                  </div>
                  <div className="review-stat-box">
                    <div className="review-stat-icon" aria-hidden="true">
                      <svg
                        width="12"
                        height="15"
                        viewBox="0 0 12 15"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M5.99625 2.00272e-05L11.4728 1.21335C11.6238 1.24891 11.7482 1.32891 11.8459 1.45335C11.9436 1.5778 11.9925 1.71558 11.9925 1.86669V8.52002C11.9925 9.19558 11.8348 9.82669 11.5195 10.4134C11.2041 11 10.7666 11.48 10.207 11.8534L5.99625 14.6667L1.78555 11.8534C1.2259 11.48 0.788396 11 0.473038 10.4134C0.157679 9.82669 0 9.19558 0 8.52002V1.86669C0 1.71558 0.0488583 1.5778 0.146575 1.45335C0.244292 1.32891 0.368658 1.24891 0.519675 1.21335L5.99625 2.00272e-05ZM5.99625 1.36002L1.3325 2.40002V8.52002C1.3325 8.97335 1.43688 9.39558 1.64564 9.78669C1.8544 10.1778 2.14532 10.4978 2.51842 10.7467L5.99625 13.0667L9.47408 10.7467C9.84718 10.4978 10.1381 10.1778 10.3469 9.78669C10.5556 9.39558 10.66 8.97335 10.66 8.52002V2.40002L5.99625 1.36002ZM8.96772 4.81335L9.90048 5.76002L5.66313 10L2.83823 7.17335L3.7843 6.22669L5.66313 8.12002L8.96772 4.81335Z"
                          fill="#00E5FF"
                        />
                      </svg>
                    </div>
                    <div>
                      <strong>ISO</strong>
                      <span>Certified Process</span>
                    </div>
                  </div>
                </div>
                <div className="review-foot-note">
                  For educational purposes only - consult a qualified
                  trichologist or dermatologist for prescription-based
                  treatment.
                </div>
              </div>
            </div>
          </article>

          {/* Section: hair score dashboard */}
          <section
            className="score-dashboard-wrap"
            aria-label="Hair score dashboard"
          >
            <article className="score-main-card">
              <h3>Overall Hair Health Index</h3>
              <p className="score-main-subtitle">
                Composite score across all clinical dimensions
              </p>

              <div className="health-ring-wrap" aria-hidden="true">
                <svg
                  className="health-ring-svg"
                  width="192"
                  height="192"
                  viewBox="0 0 192 192"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M179.478 96C179.478 49.8962 142.104 12.5218 96 12.5218C49.8962 12.5218 12.5217 49.8962 12.5217 96C12.5217 142.104 49.8962 179.478 96 179.478C142.104 179.478 179.478 142.104 179.478 96Z"
                    stroke="#0C2C45"
                    strokeWidth="14"
                  />
                  <path
                    d="M179.478 96C179.478 49.8962 142.104 12.5218 96 12.5218C49.8962 12.5218 12.5217 49.8962 12.5217 96C12.5217 142.104 49.8962 179.478 96 179.478C142.104 179.478 179.478 142.104 179.478 96Z"
                    stroke={(dseResult?.hhi || dseResult?.hairHealthIndex || 72) > 80 ? "#10B981" : (dseResult?.hhi || dseResult?.hairHealthIndex || 72) > 50 ? "#F4C430" : "#EF4444"}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={dseResult?.hhiDashArray || `${((dseResult?.hhi || dseResult?.hairHealthIndex || 72) * 502.65) / 100} 502.65`}
                  />
                </svg>
                <div className="health-ring-center">
                  <strong>{dseResult?.hhi || dseResult?.hairHealthIndex || dseResult?.totalScore || 72}</strong>
                  <span>/ 100</span>
                  <p>HAIR HEALTH INDEX</p>
                </div>
              </div>

              <div className="health-pill">{dseResult?.hhiPillLabel || asDisplayText(clinicalNarrative?.severityExplanation, "Assessment Complete")}</div>
              <p className="health-note">
                Comprehensive diagnostic complete. Review recommendations below.
              </p>

              <div className="health-bands">
                <div className="health-band">
                  <span
                    className="band-dot band-dot-green"
                    aria-hidden="true"
                  />
                  <h4>Low Risk</h4>
                  <span>75-100</span>
                </div>
                <div className="health-band health-band-active">
                  <span
                    className="band-dot band-dot-amber"
                    aria-hidden="true"
                  />
                  <h4>Moderate</h4>
                  <span>40-74</span>
                </div>
                <div className="health-band">
                  <span className="band-dot band-dot-red" aria-hidden="true" />
                  <h4>High Risk</h4>
                  <span>0-39</span>
                </div>
              </div>
            </article>

            <div className="score-side-col">
              <article className="score-side-card">
                <h3>Hair Loss Risk Score</h3>
                <p className="score-side-sub">
                  Probability of progressive loss
                </p>

                <div className="score-mini-row">
                  <div className="mini-ring" aria-hidden="true">
                    <svg
                      width="80"
                      height="80"
                      viewBox="0 0 80 80"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M73 40C73 21.7746 58.2254 7 40 7C21.7746 7 7 21.7746 7 40C7 58.2254 21.7746 73 40 73C58.2254 73 73 58.2254 73 40Z"
                        stroke="#0C2C45"
                        strokeWidth="8"
                      />
                      <path
                        d="M73 40C73 21.7746 58.2254 7 40 7C21.7746 7 7 21.7746 7 40C7 58.2254 21.7746 73 40 73C58.2254 73 73 58.2254 73 40Z"
                        stroke="#10B981"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={dseResult?.hairLossRiskDashArray || dseResult?.riskScoreDashArray || `${(dseResult?.hairLossRiskScore || dseResult?.riskScore || (100 - (dseResult?.hhi || 72))) * 2.073} 207.3`}
                      />
                    </svg>
                    <div className="mini-ring-center">
                      <strong>{dseResult?.hairLossRiskScore || dseResult?.riskScore || (100 - (dseResult?.hhi || 72))}</strong>
                      <span>/ 100</span>
                    </div>
                  </div>

                  <div className="score-mini-copy">
                    <div className="risk-line">
                      <strong>{dseResult?.severity || "MODERATE"}</strong>
                      <span>Status</span>
                    </div>
                    <p>
                      {asDisplayText(dseResult?.severitySummary || clinicalNarrative?.severityExplanation, "Current risk level based on diagnostic findings.")}
                    </p>
                  </div>
                </div>

                <div className="health-bands side-bands">
                  <div className="health-band health-band-green-active health-band-right">
                    <h4>Low</h4>
                    <span>0-30</span>
                  </div>
                  <div className="health-band health-band-right">
                    <h4>Moderate</h4>
                    <span>31-70</span>
                  </div>
                  <div className="health-band health-band-right">
                    <h4>High</h4>
                    <span>71-100</span>
                  </div>
                </div>
              </article>

              <article className="score-side-card">
                <h3>Genetic Predisposition Score</h3>
                <p className="score-side-sub">
                  Hereditary androgen sensitivity index
                </p>

                <div className="score-mini-row">
                  <div className="mini-ring" aria-hidden="true">
                    <svg
                      width="80"
                      height="80"
                      viewBox="0 0 80 80"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M73 40C73 21.7746 58.2254 7 40 7C21.7746 7 7 21.7746 7 40C7 58.2254 21.7746 73 40 73C58.2254 73 73 58.2254 73 40Z"
                        stroke="#0C2C45"
                        strokeWidth="8"
                      />
                      <path
                        d="M73 40C73 21.7746 58.2254 7 40 7C21.7746 7 7 21.7746 7 40C7 58.2254 21.7746 73 40 73C58.2254 73 73 58.2254 73 40Z"
                        stroke="#F4C430"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={dseResult?.geneticDashArray || (Number.isFinite(geneticPredispositionScore) ? `${(geneticPredispositionScore * 2.073).toFixed(2)} 207.3` : "0 207.3")}
                      />
                    </svg>
                    <div className="mini-ring-center">
                      <strong>{Number.isFinite(geneticPredispositionScore) ? geneticPredispositionScore : "--"}</strong>
                      <span>/ 100</span>
                    </div>
                  </div>

                  <div className="score-mini-copy score-mini-copy-amber">
                    <div className="risk-line">
                      <strong>{geneticPredispositionScore > 75 ? "Severe" : geneticPredispositionScore > 30 ? "Significant" : "Moderate"}</strong>
                      {dseResult?.stressLevelLabel && (
                        <span style={{ fontSize: '10px', marginLeft: 'auto', opacity: 0.8 }}>
                          Stress: {dseResult.stressLevelLabel}
                        </span>
                      )}
                    </div>
                    <p>
                      {asDisplayText(dseResult?.aiCorrelationSummary || clinicalNarrative?.rootCause, "Likely combination of genetic and physiological factors.")}
                    </p>
                  </div>
                </div>

                <div className="health-bands side-bands">
                  <div className="health-band health-band-right">
                    <h4>Low</h4>
                    <span>0-30</span>
                  </div>
                  <div className="health-band health-band-active health-band-right">
                    <h4>Moderate</h4>
                    <span>31-60</span>
                  </div>
                  <div className="health-band health-band-right">
                    <h4>High</h4>
                    <span>61-100</span>
                  </div>
                </div>
              </article>
            </div>
          </section>

          {clinicalDashboardDimensions.length > 0 && (
            <section
              className="clinical-dashboard"
              aria-label="Clinical score dashboard"
            >
              <div className="clinical-dashboard-header">
                <h3>
                  <span className="clinical-header-icon" aria-hidden="true">
                    <svg
                      width="19"
                      height="18"
                      viewBox="0 0 19 18"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1.875 9.75H6.375V15.75H1.875V9.75ZM12.375 6H16.875V15.75H12.375V6ZM7.125 2.25H11.625V15.75H7.125V2.25ZM3.375 11.25V14.25H4.875V11.25H3.375ZM8.625 3.75V14.25H10.125V3.75H8.625ZM13.875 7.5V14.25H15.375V7.5H13.875Z"
                        fill="#10B981"
                      />
                    </svg>
                  </span>
                  Clinical Score Dashboard
                </h3>
                <p>{clinicalDashboardDimensions.length} independent hair health dimensions scored 0-100</p>
              </div>

              {/* Hide Clinical Dashboard if purely dummy and we have API data without it */}
              {(!reportData || clinicalDashboardDimensions?.[0]?.fromApi) && (
                <div className="clinical-dimension-grid">
                  {clinicalDashboardDimensions.map((item) => (
                    <article className="clinical-dimension-card" key={item.title}>
                      <div className="clinical-dimension-top">
                        <h4>{item.title}</h4>
                        <span
                          className={`clinical-status-pill clinical-status-${item.tone}`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="clinical-ring-wrap" aria-hidden="true">
                        <svg
                          width="68"
                          height="68"
                          viewBox="0 0 68 68"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M60 34C60 19.6406 48.3594 8 34 8C19.6406 8 8 19.6406 8 34C8 48.3594 19.6406 60 34 60C48.3594 60 60 48.3594 60 34Z"
                            stroke="#0C2C45"
                            strokeWidth="5"
                          />
                          <path
                            d="M60 34C60 19.6406 48.3594 8 34 8C19.6406 8 8 19.6406 8 34C8 48.3594 19.6406 60 34 60C48.3594 60 60 48.3594 60 34Z"
                            className={`clinical-ring-progress clinical-ring-${item.tone}`}
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={item.dashArray}
                          />
                        </svg>
                        <div className="clinical-ring-center">
                          <strong
                            className={`clinical-score clinical-score-${item.tone}`}
                          >
                            {item.score}
                          </strong>
                          <span>/100</span>
                        </div>
                      </div>

                      <p
                        className={`clinical-score-label clinical-score-label-${item.tone}`}
                      >
                        {item.scoreLabel}
                      </p>
                      <p className="clinical-score-note">{item.note}</p>
                    </article>
                  ))}
                </div>
              )}

              <article
                className={`clinical-severity-row severity-${(dseResult?.urgency || dseResult?.urgencyFlag || "ROUTINE").toLowerCase()}`}
                aria-label="Hair fall severity index"
              >
                <span className="clinical-severity-icon-wrap" aria-hidden="true">
                  <svg
                    width="15"
                    height="14"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2.62407 11.6667V8.16671C2.62407 7.31893 2.83788 6.53337 3.2655 5.81004C3.67758 5.11004 4.23349 4.55393 4.93324 4.14171C5.65632 3.71393 6.44159 3.50004 7.28907 3.50004C8.13654 3.50004 8.92182 3.71393 9.64489 4.14171C10.3446 4.55393 10.9006 5.11004 11.3126 5.81004C11.7403 6.53337 11.9541 7.31893 11.9541 8.16671V11.6667H12.5372V12.8334H2.04094V11.6667H2.62407ZM3.79032 11.6667H10.7878V8.16671C10.7878 7.53671 10.6284 6.94949 10.3097 6.40504C9.99865 5.87615 9.5788 5.45615 9.0501 5.14504C8.50585 4.82615 7.91884 4.66671 7.28907 4.66671C6.65929 4.66671 6.07228 4.82615 5.52803 5.14504C4.99933 5.45615 4.57948 5.87615 4.26848 6.40504C3.9497 6.94949 3.79032 7.53671 3.79032 8.16671V11.6667ZM6.70594 1.16671H7.87219V2.91671H6.70594V1.16671ZM11.8258 2.80004L12.6538 3.62837L11.4176 4.86504L10.5896 4.03671L11.8258 2.80004ZM1.92432 3.62837L2.75235 2.80004L3.98858 4.03671L3.16054 4.86504L1.92432 3.62837ZM4.37344 8.16671C4.37344 7.63782 4.50367 7.14976 4.76414 6.70254C5.0246 6.25532 5.37836 5.90143 5.82542 5.64087C6.27249 5.38032 6.76037 5.25004 7.28907 5.25004V6.41671C6.97029 6.41671 6.67678 6.49448 6.40855 6.65004C6.14031 6.8056 5.92844 7.01754 5.77294 7.28587C5.61744 7.55421 5.53969 7.84782 5.53969 8.16671H4.37344Z"
                      fill="#EF4444"
                    />
                  </svg>
                </span>

                <div className="clinical-severity-copy">
                  <p className="clinical-severity-kicker">
                    Diagnosis Status: {asDisplayText(reportData?.status, "ACTIVE").replace('_', ' ')}
                  </p>
                  <p className="clinical-severity-title">
                    {asDisplayText(clinicalNarrative?.symptomCorrelation, "Analysis complete based on your profile inputs.")}
                  </p>
                </div>

                <span className={`clinical-severity-pill severity-${(dseResult?.severity || dseResult?.severityBand || "OPTIMAL").toLowerCase()}`}>
                  {dseResult?.severity || dseResult?.severityBand || "OPTIMAL"}
                </span>
              </article>
            </section>
          )}

          {/* Section: AI Photo Analysis Report */}
          {withPhotoAnalysis &&
            <section
              className="ai-photo-analysis-section"
              aria-label="AI Photo Analysis Report"
            >
              <article className="ai-photo-analysis-card">
                <header className="ai-photo-analysis-header">
                  <div className="ai-photo-analysis-title-wrap">
                    <span
                      className="ai-photo-analysis-header-icon"
                      aria-hidden="true"
                    >
                      <svg
                        width="19"
                        height="18"
                        viewBox="0 0 19 18"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1.875 4.875C1.875 4.665 1.9475 4.4875 2.0925 4.3425C2.2375 4.1975 2.415 4.125 2.625 4.125H16.125C16.335 4.125 16.5125 4.1975 16.6575 4.3425C16.8025 4.4875 16.875 4.665 16.875 4.875V15.375C16.875 15.585 16.8025 15.7625 16.6575 15.9075C16.5125 16.0525 16.335 16.125 16.125 16.125H2.625C2.415 16.125 2.2375 16.0525 2.0925 15.9075C1.9475 15.7625 1.875 15.585 1.875 15.375V4.875ZM3.375 5.625V14.625H15.375V5.625H3.375ZM10.875 12.375C11.285 12.375 11.6625 12.275 12.0075 12.075C12.3525 11.875 12.625 11.6025 12.825 11.2575C13.025 10.9125 13.125 10.535 13.125 10.125C13.125 9.715 13.025 9.3375 12.825 8.9925C12.625 8.6475 12.3525 8.375 12.0075 8.175C11.6625 7.975 11.285 7.875 10.875 7.875C10.465 7.875 10.0875 7.975 9.7425 8.175C9.3975 8.375 9.125 8.6475 8.925 8.9925C8.725 9.3375 8.625 9.715 8.625 10.125C8.625 10.535 8.725 10.9125 8.925 11.2575C9.125 11.6025 9.3975 11.875 9.7425 12.075C10.0875 12.275 10.465 12.375 10.875 12.375ZM10.875 13.875C10.195 13.875 9.5675 13.7075 8.9925 13.3725C8.4175 13.0375 7.9625 12.5825 7.6275 12.0075C7.2925 11.4325 7.125 10.805 7.125 10.125C7.125 9.445 7.2925 8.8175 7.6275 8.2425C7.9625 7.6675 8.4175 7.2125 8.9925 6.8775C9.5675 6.5425 10.195 6.375 10.875 6.375C11.555 6.375 12.1825 6.5425 12.7575 6.8775C13.3325 7.2125 13.7875 7.6675 14.1225 8.2425C14.4575 8.8175 14.625 9.445 14.625 10.125C14.625 10.805 14.4575 11.4325 14.1225 12.0075C13.7875 12.5825 13.3325 13.0375 12.7575 13.3725C12.1825 13.7075 11.555 13.875 10.875 13.875ZM3.375 1.875H7.875V3.375H3.375V1.875Z"
                          fill="#00E5FF"
                        />
                      </svg>
                    </span>
                    <div>
                      <h3>AI Photo Analysis Report</h3>
                      <p>
                        Visual scalp analysis powered by AI for enhanced accuracy
                      </p>
                    </div>
                  </div>
                </header>

                <div className="ai-photo-grid">
                  {aiPhotoTiles.map((item) => (
                    <article
                      key={item.id}
                      className={`ai-photo-tile ${item.unavailable ? "ai-photo-tile-missing" : ""}`}
                    >
                      {!item.unavailable ? (
                        <>
                          {(() => {
                            const fallbackByTileId = {
                              'front-hairline': aiPhotoImageFront,
                              'crown-view': aiPhotoImageCrown,
                              'left-profile': aiPhotoImageTemple,
                              'temple-view': aiPhotoImageTemple,
                              'right-profile': aiPhotoImageTemple,
                            };
                            const apiSrc = formatUrl(item.image);
                            const safeSrc = item.fromApi
                              ? apiSrc
                              : (apiSrc || fallbackByTileId[item.id] || aiPhotoImageFront);

                            return (
                              <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
                                <img
                                  src={safeSrc}
                                  alt={item.label}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                  onError={(e) => {
                                    if (!item.fromApi) {
                                      e.currentTarget.src = fallbackByTileId[item.id] || aiPhotoImageFront;
                                    }
                                    console.error("Image load error:", item.image);
                                  }}
                                />
                              </div>
                            );
                          })()}
                          <div
                            className="ai-photo-zone-marker"
                            style={{ top: item.markerTop, left: item.markerLeft }}
                          >
                            <span
                              className="ai-photo-zone-ring"
                              aria-hidden="true"
                            >
                              <svg
                                width="52"
                                height="52"
                                viewBox="0 0 52 52"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <circle
                                  cx="26"
                                  cy="26"
                                  r="14"
                                  fill="#F4C430"
                                  fillOpacity="0.2"
                                  stroke="#F4C430"
                                  strokeOpacity="0.7"
                                />
                                <circle
                                  cx="26"
                                  cy="26"
                                  r="6"
                                  fill="#F4C430"
                                  fillOpacity="0.85"
                                />
                              </svg>
                            </span>
                            <span className="ai-photo-zone-pill">
                              {item.zone}
                            </span>
                          </div>

                          <div className="ai-photo-tile-bottom">
                            <p>{item.label}</p>
                            <span className="ai-photo-analyzed-pill">
                              <svg
                                width="10"
                                height="9"
                                viewBox="0 0 10 9"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                              >
                                <path
                                  d="M4.6875 8.25C4.1775 8.25 3.69 8.1525 3.225 7.9575C2.78 7.7675 2.38375 7.49875 2.03625 7.15125C1.68875 6.80375 1.42 6.4075 1.23 5.9625C1.035 5.4975 0.9375 5.01 0.9375 4.5C0.9375 3.99 1.035 3.5025 1.23 3.0375C1.42 2.5925 1.68875 2.19625 2.03625 1.84875C2.38375 1.50125 2.78 1.2325 3.225 1.0425C3.69 0.8475 4.1775 0.75 4.6875 0.75C5.1975 0.75 5.685 0.8475 6.15 1.0425C6.595 1.2325 6.99125 1.50125 7.33875 1.84875C7.68625 2.19625 7.955 2.5925 8.145 3.0375C8.34 3.5025 8.4375 3.99 8.4375 4.5C8.4375 5.01 8.34 5.4975 8.145 5.9625C7.955 6.4075 7.68625 6.80375 7.33875 7.15125C6.99125 7.49875 6.595 7.7675 6.15 7.9575C5.685 8.1525 5.1975 8.25 4.6875 8.25ZM4.3125 6L6.9675 3.345L6.435 2.82L4.3125 4.9425L3.255 3.8775L2.7225 4.41L4.3125 6Z"
                                  fill="#10B981"
                                />
                              </svg>
                              Analyzed
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="ai-photo-missing-wrap">
                          <div
                            className="ai-photo-missing-icon"
                            aria-hidden="true"
                          >
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M6 5H9.8L10.6 4H13.4L14.2 5H18C18.55 5 19 5.45 19 6V18C19 18.55 18.55 19 18 19H6C5.45 19 5 18.55 5 18V6C5 5.45 5.45 5 6 5ZM6 7V17H18V7H6ZM16.6 15.2L15.2 16.6L12 13.4L8.8 16.6L7.4 15.2L10.6 12L7.4 8.8L8.8 7.4L12 10.6L15.2 7.4L16.6 8.8L13.4 12L16.6 15.2Z"
                                fill="#4A6580"
                              />
                            </svg>
                          </div>
                          <p className="ai-photo-missing-title">{item.label}</p>
                          <span className="ai-photo-missing-pill">
                            Not Provided
                          </span>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </article>

              <article className="ai-analysis-insights-card">
                <header className="ai-analysis-insights-head">
                  <h3>
                    <span
                      className="ai-analysis-insights-head-icon"
                      aria-hidden="true"
                    >
                      <svg
                        width="17"
                        height="16"
                        viewBox="0 0 17 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M6.32928 2.66675C6.56913 2.66675 6.79121 2.72675 6.99553 2.84675C7.19984 2.96675 7.36196 3.12897 7.48189 3.33342C7.60181 3.53786 7.66178 3.76008 7.66178 4.00008V8.54675C7.10213 8.12008 6.36037 7.83119 5.4365 7.68008L5.2233 8.98675C6.08499 9.13786 6.70682 9.42008 7.0888 9.83342C7.47079 10.2467 7.66178 10.8579 7.66178 11.6667C7.66178 11.969 7.58627 12.2467 7.43525 12.5001C7.28424 12.7534 7.08214 12.9556 6.82896 13.1067C6.57579 13.2579 6.29819 13.3334 5.99615 13.3334C5.69412 13.3334 5.41651 13.2579 5.16334 13.1067C4.91016 12.9556 4.70807 12.7534 4.55705 12.5001C4.40604 12.2467 4.33053 11.969 4.33053 11.6667V11.4267C4.63256 11.5334 4.93015 11.609 5.2233 11.6534L5.4365 10.3467C4.99234 10.2667 4.49487 10.0979 3.9441 9.84008C3.65984 9.70675 3.43109 9.50453 3.25786 9.23342C3.08464 8.9623 2.99803 8.6623 2.99803 8.33342C2.99803 7.80008 3.12239 7.3623 3.37113 7.02008C3.61986 6.67786 3.99296 6.44453 4.49043 6.32008L4.99678 6.18675V4.00008C4.99678 3.76008 5.05674 3.53786 5.17666 3.33342C5.29659 3.12897 5.45871 2.96675 5.66303 2.84675C5.86734 2.72675 6.08943 2.66675 6.32928 2.66675ZM8.32803 2.24008C8.07929 1.95564 7.7817 1.73342 7.43525 1.57342C7.0888 1.41341 6.72014 1.33342 6.32928 1.33342C5.84958 1.33342 5.40541 1.45341 4.99678 1.69342C4.58814 1.93342 4.2639 2.25786 4.02405 2.66675C3.7842 3.07564 3.66428 3.52008 3.66428 4.00008V5.18675C3.08686 5.41786 2.62937 5.76453 2.2918 6.22675C1.87429 6.80453 1.66553 7.50675 1.66553 8.33342C1.66553 8.84897 1.78545 9.32453 2.0253 9.76008C2.26515 10.1956 2.58939 10.5512 2.99803 10.8267V11.6667C2.99803 12.209 3.1335 12.709 3.40444 13.1667C3.67538 13.6245 4.0396 13.989 4.49709 14.2601C4.95458 14.5312 5.45427 14.6667 5.99615 14.6667C6.45809 14.6667 6.89115 14.5667 7.29534 14.3667C7.69953 14.1667 8.04376 13.8934 8.32803 13.5467C8.61229 13.8934 8.95652 14.1667 9.36071 14.3667C9.76491 14.5667 10.198 14.6667 10.6599 14.6667C11.2018 14.6667 11.7015 14.5312 12.159 14.2601C12.6165 13.989 12.9807 13.6245 13.2516 13.1667C13.5226 12.709 13.658 12.209 13.658 11.6667V10.8267C14.0667 10.5512 14.3909 10.1956 14.6308 9.76008C14.8706 9.32453 14.9905 8.84897 14.9905 8.33342C14.9905 7.50675 14.7818 6.80453 14.3643 6.22675C14.0267 5.76453 13.5692 5.41786 12.9918 5.18675V4.00008C12.9918 3.52008 12.8719 3.07564 12.632 2.66675C12.3922 2.25786 12.0679 1.93342 11.6593 1.69342C11.2506 1.45341 10.8065 1.33342 10.3268 1.33342C9.93591 1.33342 9.56725 1.41341 9.2208 1.57342C8.87435 1.73342 8.57676 1.95564 8.32803 2.24008ZM12.3255 11.4267V11.6667C12.3255 11.969 12.25 12.2467 12.099 12.5001C11.948 12.7534 11.7459 12.9556 11.4927 13.1067C11.2395 13.2579 10.9619 13.3334 10.6599 13.3334C10.3579 13.3334 10.0803 13.2579 9.82709 13.1067C9.57392 12.9556 9.37182 12.7534 9.2208 12.5001C9.06979 12.2467 8.99428 11.969 8.99428 11.6667C8.99428 10.8579 9.18527 10.2467 9.56725 9.83342C9.94924 9.42008 10.5711 9.13786 11.4328 8.98675L11.2196 7.68008C10.2957 7.83119 9.55393 8.12008 8.99428 8.54675V4.00008C8.99428 3.76008 9.05424 3.53786 9.17416 3.33342C9.29409 3.12897 9.45621 2.96675 9.66053 2.84675C9.86484 2.72675 10.0869 2.66675 10.3268 2.66675C10.5666 2.66675 10.7887 2.72675 10.993 2.84675C11.1973 2.96675 11.3595 3.12897 11.4794 3.33342C11.5993 3.53786 11.6593 3.76008 11.6593 4.00008V6.18675L12.1656 6.32008C12.6631 6.44453 13.0362 6.67786 13.2849 7.02008C13.5337 7.3623 13.658 7.80008 13.658 8.33342C13.658 8.6623 13.5714 8.9623 13.3982 9.23342C13.225 9.50453 12.9962 9.70675 12.712 9.84008C12.1612 10.0979 11.6637 10.2667 11.2196 10.3467L11.4328 11.6534C11.7259 11.609 12.0235 11.5334 12.3255 11.4267Z"
                          fill="#00E5FF"
                        />
                      </svg>
                    </span>
                    AI Analysis Insights
                  </h3>
                  <span className="ai-analysis-processed-chip">
                    3 Photos Processed
                  </span>
                </header>

                <div className="ai-analysis-insights-list">
                  {aiAnalysisInsightRows.map((item) => (
                    <article className="ai-analysis-insight-row" key={item.title}>
                      <div className="ai-analysis-insight-row-head">
                        <div className="ai-analysis-insight-title-wrap">
                          <span
                            className={`ai-analysis-insight-icon ai-analysis-insight-icon-${item.tone}`}
                            aria-hidden="true"
                          >
                            {item.icon === "hairline" && (
                              <svg
                                width="15"
                                height="14"
                                viewBox="0 0 15 14"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M3.60391 2.48492L8.1173 6.99992L7.28926 7.82825L5.28331 5.80992C5.06561 6.17547 4.95676 6.5702 4.95676 6.99409C4.95676 7.41797 5.06172 7.80881 5.27165 8.16659C5.48157 8.52436 5.76536 8.80825 6.12301 9.01825C6.48066 9.22825 6.86941 9.33325 7.28926 9.33325C7.70911 9.33325 8.09786 9.22825 8.45551 9.01825C8.81316 8.80825 9.09695 8.52436 9.30687 8.16659C9.5168 7.80881 9.62176 7.42381 9.62176 7.01159C9.62176 6.59936 9.52457 6.2202 9.3302 5.87409C9.13582 5.52797 8.87147 5.24797 8.53715 5.03409C8.20282 4.8202 7.8374 4.6977 7.44087 4.66658L6.37958 3.61658C6.67503 3.53881 6.97826 3.49992 7.28926 3.49992C7.91903 3.49992 8.50605 3.65936 9.0503 3.97825C9.579 4.28936 9.99885 4.70936 10.3098 5.23825C10.6286 5.7827 10.788 6.36992 10.788 6.99992C10.788 7.62992 10.6286 8.21714 10.3098 8.76159C9.99885 9.29047 9.579 9.71047 9.0503 10.0216C8.50605 10.3405 7.91903 10.4999 7.28926 10.4999C6.65948 10.4999 6.07247 10.3405 5.52822 10.0216C4.99952 9.71047 4.57967 9.29047 4.26867 8.76159C3.9499 8.21714 3.79051 7.62992 3.79051 6.99992C3.79051 6.62659 3.84688 6.26881 3.95961 5.92659C4.07235 5.58436 4.2298 5.26547 4.43195 4.96992L3.60391 4.14159C3.29291 4.53825 3.05188 4.9777 2.88083 5.45992C2.70978 5.9577 2.62426 6.47103 2.62426 6.99992C2.62426 7.8477 2.83807 8.63325 3.2657 9.35659C3.67777 10.0566 4.23368 10.6127 4.93343 11.0249C5.65651 11.4527 6.44178 11.6666 7.28926 11.6666C8.13673 11.6666 8.92201 11.4527 9.64508 11.0249C10.3448 10.6127 10.9007 10.0566 11.3128 9.35659C11.7404 8.63325 11.9543 7.8477 11.9543 6.99992C11.9543 6.15214 11.7404 5.36659 11.3128 4.64325C10.9007 3.94325 10.3448 3.38714 9.64508 2.97492C8.92201 2.54714 8.13673 2.33325 7.28926 2.33325C6.65171 2.33325 6.04526 2.4577 5.46991 2.70658L4.59522 1.83158C5.43492 1.38825 6.33293 1.16658 7.28926 1.16658C8.08231 1.16658 8.84037 1.31825 9.56345 1.62158C10.2554 1.91714 10.8716 2.3352 11.412 2.87575C11.9523 3.41631 12.3702 4.0327 12.6657 4.72492C12.9689 5.44825 13.1205 6.20659 13.1205 6.99992C13.1205 7.79325 12.9689 8.55159 12.6657 9.27492C12.3702 9.96714 11.9523 10.5835 11.412 11.1241C10.8716 11.6646 10.2554 12.0827 9.56345 12.3783C8.84037 12.6816 8.08231 12.8333 7.28926 12.8333C6.49621 12.8333 5.73815 12.6816 5.01507 12.3783C4.3231 12.0827 3.70693 11.6646 3.16656 11.1241C2.6262 10.5835 2.2083 9.96714 1.91285 9.27492C1.60962 8.55159 1.45801 7.79325 1.45801 6.99992C1.45801 6.10547 1.65238 5.2577 2.04113 4.45658C2.41433 3.68659 2.93526 3.02936 3.60391 2.48492Z"
                                  fill="#F4C430"
                                />
                              </svg>
                            )}
                            {item.icon === "crown" && (
                              <svg
                                width="15"
                                height="14"
                                viewBox="0 0 15 14"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M7.87201 0.583415V2.36841C8.56399 2.45397 9.20348 2.68341 9.79049 3.05675C10.3775 3.43008 10.8576 3.91036 11.2308 4.49758C11.604 5.0848 11.8334 5.72453 11.9189 6.41675H13.7033V7.58341H11.9189C11.8334 8.27564 11.604 8.91536 11.2308 9.50258C10.8576 10.0898 10.3775 10.5701 9.79049 10.9434C9.20348 11.3167 8.56399 11.5462 7.87201 11.6317V13.4167H6.70576V11.6317C6.01379 11.5462 5.37429 11.3167 4.78728 10.9434C4.20027 10.5701 3.72016 10.0898 3.34696 9.50258C2.97376 8.91536 2.7444 8.27564 2.65887 7.58341H0.874512V6.41675H2.65887C2.7444 5.72453 2.97376 5.0848 3.34696 4.49758C3.72016 3.91036 4.20027 3.43008 4.78728 3.05675C5.37429 2.68341 6.01379 2.45397 6.70576 2.36841V0.583415H7.87201ZM7.28889 3.50008C6.65911 3.50008 6.0721 3.65953 5.52785 3.97841C4.99915 4.28953 4.5793 4.70953 4.2683 5.23841C3.94952 5.78286 3.79014 6.37008 3.79014 7.00008C3.79014 7.63008 3.94952 8.2173 4.2683 8.76175C4.5793 9.29064 4.99915 9.71064 5.52785 10.0217C6.0721 10.3406 6.65911 10.5001 7.28889 10.5001C7.91866 10.5001 8.50567 10.3406 9.04992 10.0217C9.57862 9.71064 9.99847 9.29064 10.3095 8.76175C10.6282 8.2173 10.7876 7.63008 10.7876 7.00008C10.7876 6.37008 10.6282 5.78286 10.3095 5.23841C9.99847 4.70953 9.57862 4.28953 9.04992 3.97841C8.50567 3.65953 7.91866 3.50008 7.28889 3.50008ZM7.28889 5.83341C7.49881 5.83341 7.69319 5.88591 7.87201 5.99091C8.05084 6.09591 8.19273 6.23786 8.29769 6.41675C8.40266 6.59564 8.45514 6.79008 8.45514 7.00008C8.45514 7.21008 8.40266 7.40453 8.29769 7.58341C8.19273 7.7623 8.05084 7.90425 7.87201 8.00925C7.69319 8.11425 7.49881 8.16675 7.28889 8.16675C7.07896 8.16675 6.88459 8.11425 6.70576 8.00925C6.52694 7.90425 6.38504 7.7623 6.28008 7.58341C6.17512 7.40453 6.12264 7.21008 6.12264 7.00008C6.12264 6.79008 6.17512 6.59564 6.28008 6.41675C6.38504 6.23786 6.52694 6.09591 6.70576 5.99091C6.88459 5.88591 7.07896 5.83341 7.28889 5.83341Z"
                                  fill="#F4C430"
                                />
                              </svg>
                            )}
                            {item.icon === "visibility" && (
                              <svg
                                width="15"
                                height="14"
                                viewBox="0 0 15 14"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M7.2889 1.75C8.3152 1.75 9.28708 1.98333 10.2045 2.45C11.0831 2.90111 11.8237 3.52528 12.4262 4.3225C13.0288 5.11972 13.4195 6.01222 13.5983 7C13.4195 7.98778 13.0288 8.88028 12.4262 9.6775C11.8237 10.4747 11.0831 11.0989 10.2045 11.55C9.28708 12.0167 8.3152 12.25 7.2889 12.25C6.2626 12.25 5.29073 12.0167 4.37328 11.55C3.4947 11.0989 2.75414 10.4747 2.15157 9.6775C1.54901 8.88028 1.15832 7.98778 0.979492 7C1.15832 6.01222 1.54901 5.11972 2.15157 4.3225C2.75414 3.52528 3.4947 2.90111 4.37328 2.45C5.29073 1.98333 6.2626 1.75 7.2889 1.75ZM7.2889 11.0833C8.0975 11.0833 8.86723 10.9044 9.59808 10.5467C10.3056 10.2044 10.9062 9.72222 11.3999 9.1C11.8936 8.47778 12.2299 7.77778 12.4087 7C12.2299 6.22222 11.8936 5.52222 11.3999 4.9C10.9062 4.27778 10.3056 3.79556 9.59808 3.45333C8.86723 3.09556 8.0975 2.91667 7.2889 2.91667C6.4803 2.91667 5.71058 3.09556 4.97973 3.45333C4.2722 3.79556 3.67159 4.27778 3.17787 4.9C2.68416 5.52222 2.34789 6.22222 2.16907 7C2.34789 7.77778 2.68416 8.47778 3.17787 9.1C3.67159 9.72222 4.2722 10.2044 4.97973 10.5467C5.71058 10.9044 6.4803 11.0833 7.2889 11.0833ZM7.2889 9.625C6.81463 9.625 6.37729 9.50639 5.97687 9.26917C5.57646 9.03194 5.25769 8.71306 5.02055 8.3125C4.78341 7.91194 4.66484 7.47444 4.66484 7C4.66484 6.52556 4.78341 6.08806 5.02055 5.6875C5.25769 5.28694 5.57646 4.96806 5.97687 4.73083C6.37729 4.49361 6.81463 4.375 7.2889 4.375C7.76318 4.375 8.20052 4.49361 8.60094 4.73083C9.00135 4.96806 9.32012 5.28694 9.55726 5.6875C9.7944 6.08806 9.91297 6.52556 9.91297 7C9.91297 7.47444 9.7944 7.91194 9.55726 8.3125C9.32012 8.71306 9.00135 9.03194 8.60094 9.26917C8.20052 9.50639 7.76318 9.625 7.2889 9.625ZM7.2889 8.45833C7.55325 8.45833 7.79622 8.39222 8.01781 8.26C8.2394 8.12778 8.41628 7.95083 8.54845 7.72917C8.68063 7.5075 8.74672 7.26444 8.74672 7C8.74672 6.73556 8.68063 6.4925 8.54845 6.27083C8.41628 6.04917 8.2394 5.87222 8.01781 5.74C7.79622 5.60778 7.55325 5.54167 7.2889 5.54167C7.02455 5.54167 6.78159 5.60778 6.56 5.74C6.33841 5.87222 6.16153 6.04917 6.02935 6.27083C5.89718 6.4925 5.83109 6.73556 5.83109 7C5.83109 7.26444 5.89718 7.5075 6.02935 7.72917C6.16153 7.95083 6.33841 8.12778 6.56 8.26C6.78159 8.39222 7.02455 8.45833 7.2889 8.45833Z"
                                  fill="#EF4444"
                                />
                              </svg>
                            )}
                            {item.icon === "shaft" && (
                              <svg
                                width="15"
                                height="14"
                                viewBox="0 0 15 14"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M12.5373 1.45842V2.62508C12.5373 4.42953 12.2185 5.96564 11.5809 7.23341C10.99 8.41564 10.1542 9.31008 9.0735 9.91675C8.0472 10.5001 6.86929 10.7917 5.53977 10.7917H3.34722C3.25392 11.3206 3.20727 11.904 3.20727 12.5417H2.04102C2.04102 11.7484 2.1071 11.0212 2.23928 10.3601C2.1071 9.60564 2.04102 8.58286 2.04102 7.29175C2.04102 6.49841 2.19263 5.74008 2.49585 5.01675C2.7913 4.32453 3.20921 3.70814 3.74957 3.16758C4.28993 2.62703 4.9061 2.20897 5.59808 1.91341C6.32115 1.61008 7.07922 1.45842 7.87227 1.45842C8.10552 1.45842 8.47094 1.4973 8.96854 1.57508C9.37284 1.6373 9.69162 1.67619 9.92487 1.69175C10.3214 1.72286 10.7101 1.72675 11.0911 1.70341C11.5498 1.66453 12.0319 1.58286 12.5373 1.45842ZM7.87227 2.62508C7.02479 2.62508 6.23952 2.83897 5.51644 3.26675C4.81669 3.67897 4.26078 4.23508 3.8487 4.93508C3.42108 5.65841 3.20727 6.44397 3.20727 7.29175V7.89841C3.56492 7.33841 4.01587 6.8173 4.56012 6.33508C5.08104 5.87619 5.69915 5.44453 6.41445 5.04008L6.99758 6.04341C6.13455 6.54119 5.43869 7.06619 4.90999 7.61841C4.35019 8.20175 3.93423 8.87064 3.6621 9.62508H5.53977C6.71379 9.62508 7.73426 9.36841 8.60117 8.85508C9.46808 8.34175 10.1348 7.5873 10.6013 6.59175C11.0911 5.5573 11.3477 4.30897 11.371 2.84675C10.9823 2.88564 10.5857 2.8973 10.1814 2.88175C9.81602 2.85841 9.39228 2.81175 8.91023 2.74175C8.56813 2.6873 8.33877 2.65425 8.22214 2.64258C8.10552 2.63091 7.98889 2.62508 7.87227 2.62508Z"
                                  fill="#F4C430"
                                />
                              </svg>
                            )}
                          </span>
                          <h4>{item.title}</h4>
                          <span
                            className={`ai-analysis-insight-severity ai-analysis-insight-severity-${item.tone}`}
                          >
                            {item.severity}
                          </span>
                        </div>
                      </div>
                      <p>{item.desc}</p>
                    </article>
                  ))}
                </div>
              </article>

              <article className="ai-questionnaire-correlation-card">
                <h4>
                  <span
                    className="ai-questionnaire-correlation-icon"
                    aria-hidden="true"
                  >
                    <svg
                      width="17"
                      height="16"
                      viewBox="0 0 17 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M5.06366 5.85333C5.17914 6.28889 5.41677 6.64444 5.77654 6.92C6.13632 7.19556 6.54273 7.33333 6.99578 7.33333H9.66078C10.2027 7.33333 10.7068 7.45333 11.1732 7.69333C11.6395 7.93333 12.0282 8.26444 12.3391 8.68667C12.65 9.10889 12.8499 9.57778 12.9387 10.0933C13.3474 10.2267 13.6805 10.4689 13.9381 10.82C14.1957 11.1711 14.3245 11.5644 14.3245 12C14.3245 12.3644 14.2357 12.7 14.058 13.0067C13.8804 13.3133 13.6383 13.5556 13.3318 13.7333C13.0253 13.9111 12.69 14 12.3258 14C11.9616 14 11.6262 13.9111 11.3197 13.7333C11.0133 13.5556 10.7712 13.3133 10.5935 13.0067C10.4159 12.7 10.327 12.3644 10.327 12C10.327 11.5822 10.4447 11.2044 10.6801 10.8667C10.9156 10.5289 11.2198 10.2889 11.5929 10.1467C11.4774 9.71111 11.2398 9.35556 10.88 9.08C10.5202 8.80444 10.1138 8.66667 9.66078 8.66667H6.99578C6.62268 8.66667 6.26735 8.60889 5.92978 8.49333C5.59221 8.37778 5.2813 8.21333 4.99703 8V10.12C5.3879 10.2533 5.7077 10.4933 5.95643 10.84C6.20516 11.1867 6.32953 11.5733 6.32953 12C6.32953 12.3644 6.2407 12.7 6.06303 13.0067C5.88536 13.3133 5.64329 13.5556 5.33682 13.7333C5.03034 13.9111 4.695 14 4.33078 14C3.96656 14 3.63122 13.9111 3.32474 13.7333C3.01827 13.5556 2.7762 13.3133 2.59853 13.0067C2.42086 12.7 2.33203 12.3644 2.33203 12C2.33203 11.5733 2.4564 11.1867 2.70513 10.84C2.95386 10.4933 3.27366 10.2533 3.66453 10.12V5.88C3.27366 5.74667 2.95386 5.50667 2.70513 5.16C2.4564 4.81333 2.33203 4.42667 2.33203 4C2.33203 3.63556 2.42086 3.3 2.59853 2.99333C2.7762 2.68667 3.01827 2.44444 3.32474 2.26667C3.63122 2.08889 3.96656 2 4.33078 2C4.695 2 5.03034 2.08889 5.33682 2.26667C5.64329 2.44444 5.88536 2.68667 6.06303 2.99333C6.2407 3.3 6.32953 3.63556 6.32953 4C6.32953 4.41778 6.21183 4.79556 5.97642 5.13333C5.74101 5.47111 5.43676 5.71111 5.06366 5.85333Z"
                        fill="#10B981"
                      />
                    </svg>
                  </span>
                  AI + Questionnaire Correlation
                </h4>
                <p>
                  {asDisplayText(clinicalNarrative?.aiCorrelationSummary,
                    `Photo analysis confirms thinning patterns detected in your profile. Visual data indicates crown and hairline recession are consistent with physiological indicators - highlighting ${dseResult?.topConditions?.[0] || 'active condition'} progression.`
                  )}
                </p>

                {evidenceTrail.length > 0 && (
                  <div className="evidence-trail-wrap">
                    <h5>Evidence Trail (Diagnostic Basis)</h5>
                    <div className="evidence-trail-list">
                      {evidenceTrail.map((ev, idx) => (
                        <div key={idx} className="evidence-item">
                          <span className="evidence-claim">{ev.claim}</span>
                          <div className="evidence-sources">
                            {ev.sources.map((s, si) => <span key={si} className="source-tag">{s}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>

              <div className="ai-photo-metrics-grid">
                {aiPhotoMetricCards.map((item) => (
                  <article className="ai-photo-metric-card" key={item.title}>
                    <p className="ai-photo-metric-kicker">{item.title}</p>
                    <p className="ai-photo-metric-value-row">
                      {item.tone === "confidence" && (
                        <span
                          className="ai-photo-confidence-icon"
                          aria-hidden="true"
                        >
                          <svg
                            width="17"
                            height="16"
                            viewBox="0 0 17 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M8.32828 0.666585L13.8049 1.87992C13.9559 1.91547 14.0802 1.99547 14.178 2.11992C14.2757 2.24436 14.3245 2.38214 14.3245 2.53325V9.18658C14.3245 9.86214 14.1669 10.4933 13.8515 11.0799C13.5361 11.6666 13.0986 12.1466 12.539 12.5199L8.32828 15.3333L4.11758 12.5199C3.55793 12.1466 3.12043 11.6666 2.80507 11.0799C2.48971 10.4933 2.33203 9.86214 2.33203 9.18658V2.53325C2.33203 2.38214 2.38089 2.24436 2.47861 2.11992C2.57632 1.99547 2.70069 1.91547 2.85171 1.87992L8.32828 0.666585ZM8.32828 2.02658L3.66453 3.06658V9.18658C3.66453 9.63992 3.76891 10.0621 3.97767 10.4533C4.18643 10.8444 4.47736 11.1644 4.85046 11.4133L8.32828 13.7333L11.8061 11.4133C12.1792 11.1644 12.4701 10.8444 12.6789 10.4533C12.8877 10.0621 12.992 9.63992 12.992 9.18658V3.06658L8.32828 2.02658ZM11.2998 5.47992L12.2325 6.42659L7.99516 10.6666L5.17026 7.83992L6.11633 6.89325L7.99516 8.78659L11.2998 5.47992Z"
                              fill="#10B981"
                            />
                          </svg>
                        </span>
                      )}
                      <strong
                        className={`ai-photo-metric-value ai-photo-metric-value-${item.tone}`}
                      >
                        {item.value}
                      </strong>
                    </p>
                    <p
                      className={`ai-photo-metric-subtitle ai-photo-metric-subtitle-${item.tone}`}
                    >
                      {item.subtitle}
                    </p>

                    <div className="ai-photo-metric-track" aria-hidden="true">
                      <span
                        className={`ai-photo-metric-fill ai-photo-metric-fill-${item.tone}`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </article>
                ))}
              </div>

              <article className="ai-photo-security-note">
                <span className="ai-photo-security-icon" aria-hidden="true">
                  <svg
                    width="15"
                    height="14"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11.371 5.83325H11.9541C12.1174 5.83325 12.2554 5.88964 12.3682 6.00242C12.4809 6.1152 12.5373 6.25325 12.5373 6.41659V12.2499C12.5373 12.4133 12.4809 12.5513 12.3682 12.6641C12.2554 12.7769 12.1174 12.8333 11.9541 12.8333H2.62414C2.46087 12.8333 2.32286 12.7769 2.21012 12.6641C2.09738 12.5513 2.04102 12.4133 2.04102 12.2499V6.41659C2.04102 6.25325 2.09738 6.1152 2.21012 6.00242C2.32286 5.88964 2.46087 5.83325 2.62414 5.83325H3.20727V5.24992C3.20727 4.51103 3.39387 3.8227 3.76707 3.18492C4.12472 2.57047 4.61065 2.08436 5.22488 1.72659C5.86243 1.35325 6.55052 1.16658 7.28914 1.16658C8.02777 1.16658 8.71585 1.35325 9.3534 1.72659C9.96763 2.08436 10.4536 2.57047 10.8112 3.18492C11.1844 3.8227 11.371 4.51103 11.371 5.24992V5.83325ZM3.20727 6.99992V11.6666H11.371V6.99992H3.20727ZM6.70602 8.16659H7.87227V10.4999H6.70602V8.16659ZM10.2048 5.83325V5.24992C10.2048 4.72103 10.0745 4.23297 9.81407 3.78575C9.55361 3.33853 9.19985 2.98464 8.75278 2.72408C8.30572 2.46353 7.81784 2.33325 7.28914 2.33325C6.76044 2.33325 6.27256 2.46353 5.8255 2.72408C5.37843 2.98464 5.02467 3.33853 4.76421 3.78575C4.50375 4.23297 4.37352 4.72103 4.37352 5.24992V5.83325H10.2048Z"
                      fill="#9FB4D0"
                    />
                  </svg>
                </span>
                <p>
                  Your photos are processed securely using on-device AI and are
                  <span> never stored</span> after analysis is complete.
                </p>
              </article>
            </section>
          }

          {deepMetricRows.length > 0 && (
            <section
              className="deep-metric-section"
              aria-label="Deep metric insights"
            >
              <div className="deep-metric-header">
                <h3>
                  <span className="deep-metric-header-icon" aria-hidden="true">
                    <svg
                      width="19"
                      height="18"
                      viewBox="0 0 19 18"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M10.275 1.98002L12.705 6.19502C12.815 6.37502 12.8425 6.56502 12.7875 6.76502C12.7325 6.96502 12.615 7.11502 12.435 7.21502L11.46 7.78502L12.21 9.09002L10.905 9.84002L10.155 8.53502L9.195 9.09002C9.015 9.20002 8.825 9.22752 8.625 9.17252C8.425 9.11752 8.27 9.00002 8.16 8.82002L6.78 6.43502C6.27 6.59502 5.815 6.85002 5.415 7.20002C5.015 7.55002 4.7 7.97002 4.47 8.46002C4.24 8.95002 4.125 9.47002 4.125 10.02C4.125 10.48 4.205 10.925 4.365 11.355C4.975 10.965 5.645 10.77 6.375 10.77C6.995 10.77 7.5725 10.9125 8.1075 11.1975C8.6425 11.4825 9.085 11.87 9.435 12.36L15.195 9.03002L15.945 10.32L10.035 13.74C10.095 14 10.125 14.26 10.125 14.52C10.125 14.78 10.1 15.03 10.05 15.27H16.125V16.77H3.375C3.135 16.45 2.95 16.1 2.82 15.72C2.69 15.34 2.625 14.94 2.625 14.52C2.625 13.78 2.83 13.1 3.24 12.48C2.83 11.71 2.625 10.89 2.625 10.02C2.625 9.29002 2.77 8.59002 3.06 7.92002C3.35 7.27002 3.75 6.70252 4.26 6.21752C4.77 5.73252 5.355 5.36502 6.015 5.11502L5.73 4.60502C5.59 4.36502 5.52 4.11252 5.52 3.84752C5.52 3.58252 5.5875 3.33502 5.7225 3.10502C5.8575 2.87502 6.04 2.69002 6.27 2.55002L8.22 1.42502C8.46 1.28502 8.7125 1.21752 8.9775 1.22252C9.2425 1.22752 9.49 1.29502 9.72 1.42502C9.95 1.55502 10.135 1.74002 10.275 1.98002ZM6.375 12.27C5.965 12.27 5.5875 12.3725 5.2425 12.5775C4.8975 12.7825 4.625 13.0575 4.425 13.4025C4.225 13.7475 4.125 14.12 4.125 14.52C4.125 14.78 4.17 15.03 4.26 15.27H8.49C8.58 15.03 8.625 14.78 8.625 14.52C8.625 14.12 8.525 13.7475 8.325 13.4025C8.125 13.0575 7.8525 12.7825 7.5075 12.5775C7.1625 12.3725 6.785 12.27 6.375 12.27ZM8.97 2.73002L7.02 3.85502L9.09 7.42502L11.04 6.30002L8.97 2.73002Z"
                        fill="#00E5FF"
                      />
                    </svg>
                  </span>
                  Deep Metric Insights
                </h3>
                <p>
                  Personalised benchmarks and clinical interpretation for your key
                  scores
                </p>
              </div>

              <div className="deep-metric-list">
                {deepMetricRows.map((metric) => (
                  <article className="deep-metric-card" key={metric.title}>
                    <div className="deep-metric-card-head">
                      <h4>
                        <span
                          className={`deep-metric-dot deep-metric-dot-${metric.tone}`}
                          aria-hidden="true"
                        />
                        {metric.title}
                      </h4>
                      <p>
                        <strong
                          className={`deep-metric-score deep-metric-score-${metric.tone}`}
                        >
                          {metric.score}
                        </strong>
                        <span>/ 100</span>
                      </p>
                    </div>

                    {metric.blurb && (
                      <p className="deep-metric-card-blurb">{metric.blurb}</p>
                    )}

                    <div
                      className="deep-metric-progress-track"
                      aria-hidden="true"
                    >
                      <span
                        className={`deep-metric-progress-fill deep-metric-progress-fill-${metric.tone}`}
                        style={{ width: `${metric.progress}%` }}
                      />
                    </div>

                    <div className="deep-metric-panels">
                      <div
                        className={`deep-metric-panel deep-metric-panel-stand deep-metric-panel-stand-${metric.tone}`}
                      >
                        <h5>WHERE YOU STAND</h5>
                        <strong>{metric.scoreStand}</strong>
                        <p>{metric.scoreNote}</p>
                      </div>
                      <div className="deep-metric-panel deep-metric-panel-benchmark">
                        <h5>{metric.benchmarkTitle}</h5>
                        {metric.benchmarkLines.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                    </div>

                    <div
                      className={`deep-metric-meaning-row deep-metric-meaning-row-${metric.tone}`}
                    >
                      <span
                        className="deep-metric-meaning-icon"
                        aria-hidden="true"
                      >
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M7.28901 12.8333C6.49596 12.8333 5.7379 12.6816 5.01483 12.3783C4.32285 12.0827 3.70668 11.6646 3.16632 11.1241C2.62596 10.5835 2.20805 9.96714 1.9126 9.27492C1.60938 8.55159 1.45776 7.79325 1.45776 6.99992C1.45776 6.20659 1.60938 5.44825 1.9126 4.72492C2.20805 4.0327 2.62596 3.41631 3.16632 2.87575C3.70668 2.3352 4.32285 1.91714 5.01483 1.62158C5.7379 1.31825 6.49596 1.16658 7.28901 1.16658C8.08206 1.16658 8.84013 1.31825 9.5632 1.62158C10.2552 1.91714 10.8713 2.3352 11.4117 2.87575C11.9521 3.41631 12.37 4.0327 12.6654 4.72492C12.9687 5.44825 13.1203 6.20659 13.1203 6.99992C13.1203 7.79325 12.9687 8.55159 12.6654 9.27492C12.37 9.96714 11.9521 10.5835 11.4117 11.1241C10.8713 11.6646 10.2552 12.0827 9.5632 12.3783C8.84013 12.6816 8.08206 12.8333 7.28901 12.8333ZM7.28901 11.6666C8.13649 11.6666 8.92176 11.4527 9.64484 11.0249C10.3446 10.6127 10.9005 10.0566 11.3126 9.35659C11.7402 8.63325 11.954 7.8477 11.954 6.99992C11.954 6.15214 11.7402 5.36659 11.3126 4.64325C10.9005 3.94325 10.3446 3.38714 9.64484 2.97492C8.92176 2.54714 8.13649 2.33325 7.28901 2.33325C6.44154 2.33325 5.65626 2.54714 4.93319 2.97492C4.23344 3.38714 3.67753 3.94325 3.26545 4.64325C2.83783 5.36659 2.62401 6.15214 2.62401 6.99992C2.62401 7.8477 2.83783 8.63325 3.26545 9.35659C3.67753 10.0566 4.23344 10.6127 4.93319 11.0249C5.65626 11.4527 6.44154 11.6666 7.28901 11.6666ZM6.70589 4.08325H7.87214V5.24992H6.70589V4.08325ZM6.70589 6.41659H7.87214V9.91659H6.70589V6.41659Z"
                            fill="currentColor"
                          />
                        </svg>
                      </span>
                      <p>
                        <strong>What this means for you:</strong> {metric.meaning}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {regionalZones.length > 0 && (
            <section
              className="regional-analysis-section"
              aria-label="Regional analysis"
            >
              <article className="regional-analysis-card">
                <div className="regional-analysis-header">
                  <span
                    className="regional-analysis-icon-wrap"
                    aria-hidden="true"
                  >
                    <svg
                      width="21"
                      height="20"
                      viewBox="0 0 21 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M10.414 19.05L5.11534 13.75C4.14892 12.7945 3.49908 11.6612 3.16583 10.35C2.83258 9.08338 2.83258 7.81672 3.16583 6.55005C3.49908 5.23894 4.14614 4.10283 5.10701 3.14172C6.06788 2.1806 7.20371 1.52783 8.51449 1.18338C9.78084 0.861158 11.0472 0.861158 12.3135 1.18338C13.6243 1.52783 14.7602 2.1806 15.721 3.14172C16.6819 4.10283 17.329 5.23894 17.6622 6.55005C17.9955 7.81672 17.9955 9.08338 17.6622 10.35C17.329 11.6612 16.6791 12.7945 15.7127 13.75L10.414 19.05ZM14.5297 12.5667C15.285 11.8223 15.796 10.9445 16.0626 9.93338C16.3181 8.94449 16.3181 7.9556 16.0626 6.96671C15.796 5.9556 15.2878 5.07505 14.538 4.32505C13.7882 3.57505 12.9078 3.06671 11.897 2.80005C10.9083 2.54449 9.9197 2.54449 8.93106 2.80005C7.9202 3.06671 7.03986 3.57505 6.29005 4.32505C5.54024 5.07505 5.03203 5.9556 4.76543 6.96671C4.50994 7.9556 4.50994 8.94449 4.76543 9.93338C5.03203 10.9445 5.54301 11.8223 6.29838 12.5667L10.414 16.7L14.5297 12.5667ZM10.414 10.1167C10.1141 10.1167 9.83639 10.0417 9.58089 9.89172C9.3254 9.74172 9.12267 9.53894 8.97271 9.28338C8.82275 9.02783 8.74777 8.75005 8.74777 8.45005C8.74777 8.15005 8.82275 7.87227 8.97271 7.61671C9.12267 7.36116 9.3254 7.15838 9.58089 7.00838C9.83639 6.85838 10.1141 6.78338 10.414 6.78338C10.7139 6.78338 10.9917 6.85838 11.2471 7.00838C11.5026 7.15838 11.7054 7.36116 11.8553 7.61671C12.0053 7.87227 12.0803 8.15005 12.0803 8.45005C12.0803 8.75005 12.0053 9.02783 11.8553 9.28338C11.7054 9.53894 11.5026 9.74172 11.2471 9.89172C10.9917 10.0417 10.7139 10.1167 10.414 10.1167Z"
                        fill="#00E5FF"
                      />
                    </svg>
                  </span>
                  <div>
                    <p className="regional-analysis-kicker">Regional Analysis</p>
                    <h3>Scalp Density Map</h3>
                    <p className="regional-analysis-subtitle">
                      Zone-by-zone follicular coverage analysis
                    </p>
                  </div>
                </div>

                <div className="regional-analysis-body">
                  <div className="regional-analysis-left">
                    <svg
                      className="regional-scalp-map"
                      width="160"
                      height="208"
                      viewBox="0 0 160 208"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M80.0001 193.818C114.578 193.818 142.609 153.605 142.609 104C142.609 54.3949 114.578 14.1819 80.0001 14.1819C45.4222 14.1819 17.3914 54.3949 17.3914 104C17.3914 153.605 45.4222 193.818 80.0001 193.818Z"
                        fill="#041126"
                        fillOpacity="0.8"
                        stroke="#00E5FF"
                        strokeOpacity="0.15"
                      />
                      <path
                        d="M80 81.309C93.447 81.309 104.348 69.4567 104.348 54.8363C104.348 40.2158 93.447 28.3635 80 28.3635C66.5531 28.3635 55.6522 40.2158 55.6522 54.8363C55.6522 69.4567 66.5531 81.309 80 81.309Z"
                        fill="#F4C430"
                        fillOpacity="0.0941176"
                        stroke="#F4C430"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M80.0001 66.749C86.0512 66.749 90.9566 61.4155 90.9566 54.8363C90.9566 48.2571 86.0512 42.9236 80.0001 42.9236C73.949 42.9236 69.0436 48.2571 69.0436 54.8363C69.0436 61.4155 73.949 66.749 80.0001 66.749Z"
                        fill="#F4C430"
                        fillOpacity="0.25098"
                      />
                      <path
                        d="M80.0001 57.6727C81.4408 57.6727 82.6087 56.4028 82.6087 54.8364C82.6087 53.2699 81.4408 52 80.0001 52C78.5593 52 77.3914 53.2699 77.3914 54.8364C77.3914 56.4028 78.5593 57.6727 80.0001 57.6727Z"
                        fill="#F4C430"
                      />
                      <path
                        d="M80.0001 121.964C91.526 121.964 100.87 111.805 100.87 99.2727C100.87 86.7409 91.526 76.5818 80.0001 76.5818C68.4741 76.5818 59.1305 86.7409 59.1305 99.2727C59.1305 111.805 68.4741 121.964 80.0001 121.964Z"
                        fill="#F4C430"
                        fillOpacity="0.0941176"
                        stroke="#F4C430"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M80.0001 109.484C85.1867 109.484 89.3914 104.912 89.3914 99.2727C89.3914 93.6333 85.1867 89.0618 80.0001 89.0618C74.8134 89.0618 70.6088 93.6333 70.6088 99.2727C70.6088 104.912 74.8134 109.484 80.0001 109.484Z"
                        fill="#F4C430"
                        fillOpacity="0.25098"
                      />
                      <path
                        d="M80.0001 102.109C81.4408 102.109 82.6087 100.839 82.6087 99.2726C82.6087 97.7062 81.4408 96.4363 80.0001 96.4363C78.5593 96.4363 77.3914 97.7062 77.3914 99.2726C77.3914 100.839 78.5593 102.109 80.0001 102.109Z"
                        fill="#F4C430"
                      />
                      <path
                        d="M79.9999 160.727C89.6049 160.727 97.3913 152.261 97.3913 141.818C97.3913 131.375 89.6049 122.909 79.9999 122.909C70.395 122.909 62.6086 131.375 62.6086 141.818C62.6086 152.261 70.395 160.727 79.9999 160.727Z"
                        fill="#F4C430"
                        fillOpacity="0.0941176"
                        stroke="#F4C430"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M79.9999 150.327C84.3221 150.327 87.826 146.518 87.826 141.818C87.826 137.119 84.3221 133.309 79.9999 133.309C75.6777 133.309 72.1738 137.119 72.1738 141.818C72.1738 146.518 75.6777 150.327 79.9999 150.327Z"
                        fill="#F4C430"
                        fillOpacity="0.25098"
                      />
                      <path
                        d="M79.9999 144.655C81.4407 144.655 82.6086 143.385 82.6086 141.818C82.6086 140.252 81.4407 138.982 79.9999 138.982C78.5592 138.982 77.3912 140.252 77.3912 141.818C77.3912 143.385 78.5592 144.655 79.9999 144.655Z"
                        fill="#F4C430"
                      />
                    </svg>
                    <span className="regional-scalp-label">SCALP</span>

                    <div className="regional-representative-wrap">
                      <div
                        className="regional-representative-image"
                        style={{
                          backgroundImage: `url(${scalpRepresentativeImage})`,
                        }}
                      />
                      <p>Representative image</p>
                    </div>
                  </div>

                  <div className="regional-analysis-right">
                    {regionalZones.map((zone) => (
                      <article className="regional-zone-row" key={zone.name}>
                        <div className="regional-zone-head">
                          <h4>{zone.name}</h4>
                          <span>{zone.percent}%</span>
                        </div>
                        <p>{zone.note}</p>
                        <div className="regional-zone-track" aria-hidden="true">
                          <span
                            className="regional-zone-fill"
                            style={{ width: `${zone.percent}%` }}
                          />
                        </div>
                        <em>{zone.status}</em>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="regional-overall-wrap">
                  <div className="regional-overall-head">
                    <h4>Overall Scalp Coverage</h4>
                    <p>{Math.round((regionalZones.reduce((acc, z) => acc + z.percent, 0) / (regionalZones.length || 1)))}% - Coverage</p>
                  </div>

                  <div className="regional-overall-track" aria-hidden="true">
                    <span
                      className="regional-overall-fill"
                      style={{ width: `${Math.round((regionalZones.reduce((acc, z) => acc + z.percent, 0) / (regionalZones.length || 1)))}%` }}
                    />
                  </div>

                  <div className="regional-overall-legend">
                    <div className="regional-legend-item">
                      <span
                        className="regional-legend-swatch regional-legend-red"
                        aria-hidden="true"
                      />
                      <p>
                        Poor <small>0-49%</small>
                      </p>
                    </div>
                    <div className="regional-legend-item">
                      <span
                        className="regional-legend-swatch regional-legend-amber"
                        aria-hidden="true"
                      />
                      <p>
                        Moderate <small>50-74%</small>
                      </p>
                    </div>
                    <div className="regional-legend-item">
                      <span
                        className="regional-legend-swatch regional-legend-green"
                        aria-hidden="true"
                      />
                      <p>
                        Good <small>75-100%</small>
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </section>
          )}

          {primaryCauses.length > 0 && (
            <section
              className="root-cause-section"
              aria-label="Root cause analysis"
            >
              <div className="title-wrapper">
                <span
                  className="root-cause-title-icon title-icon-bg"
                  aria-hidden="true"
                >
                  <svg
                    width="19"
                    height="18"
                    viewBox="0 0 19 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13.785 12.3451L16.995 15.5551L15.93 16.6201L12.72 13.4101C12.13 13.8801 11.485 14.2401 10.785 14.4901C10.045 14.7501 9.285 14.8801 8.505 14.8801C7.285 14.8801 6.15 14.5751 5.1 13.9651C4.08 13.3651 3.275 12.5551 2.685 11.5351C2.065 10.4851 1.755 9.35012 1.755 8.13012C1.755 6.91012 2.065 5.77512 2.685 4.72512C3.275 3.70512 4.08 2.90012 5.1 2.31012C6.15 1.69012 7.285 1.38012 8.505 1.38012C9.725 1.38012 10.86 1.69012 11.91 2.31012C12.93 2.90012 13.74 3.70512 14.34 4.72512C14.95 5.77512 15.255 6.91012 15.255 8.13012C15.255 8.91012 15.125 9.67012 14.865 10.4101C14.615 11.1101 14.255 11.7551 13.785 12.3451ZM12.27 11.7901C12.74 11.3101 13.105 10.7601 13.365 10.1401C13.625 9.50012 13.755 8.83012 13.755 8.13012C13.755 7.18012 13.515 6.29512 13.035 5.47512C12.575 4.68512 11.95 4.06012 11.16 3.60012C10.34 3.12012 9.455 2.88012 8.505 2.88012C7.555 2.88012 6.67 3.12012 5.85 3.60012C5.06 4.06012 4.435 4.68512 3.975 5.47512C3.495 6.29512 3.255 7.18012 3.255 8.13012C3.255 9.08012 3.495 9.96512 3.975 10.7851C4.435 11.5751 5.06 12.2001 5.85 12.6601C6.67 13.1401 7.555 13.3801 8.505 13.3801C9.205 13.3801 9.875 13.2501 10.515 12.9901C11.135 12.7301 11.685 12.3651 12.165 11.8951L12.27 11.7901ZM9.39 5.26512C9.13 5.38512 8.9175 5.56762 8.7525 5.81262C8.5875 6.05762 8.505 6.33012 8.505 6.63012C8.505 6.90012 8.5725 7.15012 8.7075 7.38012C8.8425 7.61012 9.025 7.79262 9.255 7.92762C9.485 8.06262 9.735 8.13012 10.005 8.13012C10.305 8.13012 10.5775 8.05012 10.8225 7.89012C11.0675 7.73012 11.25 7.51512 11.37 7.24512C11.46 7.53512 11.505 7.83012 11.505 8.13012C11.505 8.67012 11.37 9.17012 11.1 9.63012C10.83 10.0901 10.465 10.4551 10.005 10.7251C9.545 10.9951 9.045 11.1301 8.505 11.1301C7.965 11.1301 7.465 10.9951 7.005 10.7251C6.545 10.4551 6.18 10.0901 5.91 9.63012C5.64 9.17012 5.505 8.67012 5.505 8.13012C5.505 7.59012 5.64 7.09012 5.91 6.63012C6.18 6.17012 6.545 5.80512 7.005 5.53512C7.465 5.26512 7.965 5.13012 8.505 5.13012C8.805 5.13012 9.1 5.17512 9.39 5.26512Z"
                      fill="#00E5FF"
                    />
                  </svg>
                </span>
                <div>
                  <div className="root-cause-header">
                    <h3>Root Cause Analysis</h3>
                    <span className="root-cause-engine-chip">
                      AI Assessment Engine
                    </span>
                  </div>
                  <p className="root-cause-subtitle">
                    Probability-weighted causal attribution model
                  </p>
                </div>
              </div>
              <div className="root-cause-top-title">
                <span className="root-cause-top-marker" aria-hidden="true" />
                <p>Top {primaryCauses.length || 3} Primary Causes Ranked</p>
              </div>

              <div className="root-cause-primary-list">
                {primaryCauses.map((cause) => (
                  <article
                    className={`root-cause-card root-cause-card-${cause.tone}`}
                    key={cause.rank}
                  >
                    <div className="root-cause-card-head">
                      <div className="root-cause-rank-wrap">
                        <span
                          className={`root-cause-rank root-cause-rank-${cause.tone}`}
                        >
                          #{cause.rank}
                        </span>
                        <h4>{cause.title}</h4>
                      </div>
                      <span
                        className={`root-cause-tag root-cause-tag-${cause.tone}`}
                      >
                        {cause.tag}
                      </span>
                    </div>

                    <p className="root-cause-summary">{cause.summary}</p>

                    <div className="root-cause-score-row">
                      <div className="root-cause-track" aria-hidden="true">
                        <span
                          className={`root-cause-fill root-cause-fill-${cause.tone}`}
                          style={{ width: `${cause.score}%` }}
                        />
                      </div>
                      <p>
                        <strong
                          className={`root-cause-score root-cause-score-${cause.tone}`}
                        >
                          {cause.score}%
                        </strong>
                        <span>Impact Score</span>
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {secondaryCauses.length > 0 && (
            <section
              className={`additional-factors-section ${fullReport
                ? "additional-factors-section-colored"
                : "additional-factors-section-dull"
                }`}
              aria-label="Additional contributing factors"
            >
              <div className="additional-factors-title-row">
                <span
                  className="additional-factors-title-icon"
                  aria-hidden="true"
                >
                  <svg
                    width="4"
                    height="16"
                    viewBox="0 0 4 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M0 2C0 0.895431 0.895431 0 2 0C3.10457 0 4 0.895431 4 2V14C4 15.1046 3.10457 16 2 16C0.895431 16 0 15.1046 0 14V2Z"
                      fill={fullReport ? "#00E5FF" : "#4A6080"}
                    />
                  </svg>
                </span>
                <h3>Additional Contributing Factors</h3>
              </div>

              <div className="additional-factors-list">
                {secondaryCauses.map((factor) => {
                  const factorTone = getAdditionalFactorTone(factor.tag);

                  return (
                    <article
                      className={`additional-factor-card additional-factor-card-${factorTone}`}
                      key={factor.rank}
                    >
                      <div className="additional-factor-head">
                        <div className="additional-factor-rank-title">
                          <span
                            className={`additional-factor-rank additional-factor-rank-${factorTone}`}
                          >
                            #{factor.rank}
                          </span>
                          <h4>{factor.title}</h4>
                        </div>
                        <span
                          className={`additional-factor-tag additional-factor-tag-${factorTone}`}
                        >
                          {factor.tag}
                        </span>
                      </div>

                      <p className="additional-factor-summary">{factor.summary}</p>

                      <div className="additional-factor-progress-row">
                        <div className="additional-factor-track" aria-hidden="true">
                          <span
                            className={`additional-factor-fill additional-factor-fill-${factorTone}`}
                            style={{ width: `${factor.score}%` }}
                          />
                        </div>
                        <span
                          className={`additional-factor-score additional-factor-score-${factorTone}`}
                        >
                          {factor.score}%
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {scalpRecoveryCards.length > 0 && (
            <section
              className="scalp-recovery-section"
              aria-label="Scalp condition and recovery"
            >
              <div className="title-wrapper">
                <span
                  className="scalp-recovery-icon title-icon-bg"
                  aria-hidden="true"
                >
                  <svg
                    width="22"
                    height="18"
                    viewBox="0 0 22 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11 1.5L2 6.5V11.5L11 16.5L20 11.5V6.5L11 1.5Z"
                      stroke="#00E5FF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 6.5L11 11.5L20 6.5"
                      stroke="#00E5FF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M11 16.5V11.5"
                      stroke="#00E5FF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div className="scalp-recovery-header">
                  <h3>Scalp Condition & Recovery</h3>
                  <p>Scalp health and follicle recovery assessment</p>
                </div>
              </div>

              <div className="scalp-recovery-grid">
                {scalpRecoveryCards.map((card) => {
                  const scoreValue = Number(card.score);
                  const safeScore = Number.isFinite(scoreValue)
                    ? Math.max(0, Math.min(100, scoreValue))
                    : 0;
                  const toneRaw = String(card.tone || "").toLowerCase();
                  const ringTone = ["amber", "cyan", "green", "red"].includes(toneRaw)
                    ? toneRaw
                    : safeScore >= 67
                      ? "cyan"
                      : "amber";
                  const ringRadius = 36.48;
                  const ringCircumference = 2 * Math.PI * ringRadius;
                  const ringProgress = (safeScore / 100) * ringCircumference;

                  return (
                    <article className="scalp-recovery-card" key={card.title}>
                      <p className="scalp-recovery-card-title">{card.title}</p>

                      <div className="scalp-recovery-ring-wrap" aria-hidden="true">
                        <svg
                          className="scalp-recovery-ring-svg"
                          width="96"
                          height="96"
                          viewBox="0 0 96 96"
                          fill="none"
                        >
                          <circle
                            className="scalp-recovery-ring-track"
                            cx="48"
                            cy="48"
                            r={ringRadius}
                            strokeWidth="7"
                          />
                          <circle
                            className={`scalp-recovery-ring-progress scalp-recovery-ring-progress-${ringTone}`}
                            cx="48"
                            cy="48"
                            r={ringRadius}
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeDasharray={card.dashArray || `${ringProgress.toFixed(2)} ${ringCircumference.toFixed(2)}`}
                          />
                        </svg>
                        <div className="scalp-recovery-ring-center">
                          <strong>{safeScore}</strong>
                          <span>/100</span>
                        </div>
                      </div>

                      <p
                        className={`scalp-recovery-score-label scalp-recovery-score-label-${ringTone}`}
                      >
                        {card.scoreLabel}
                      </p>
                      <p className="scalp-recovery-note">{card.note}</p>

                      <div className="scalp-recovery-levels" role="presentation">
                        {card.levels.map((level) => {
                          const isActive =
                            String(card.activeLevel || "").toLowerCase() ===
                            String(level || "").toLowerCase();
                          return (
                            <span
                              key={level}
                              className={`scalp-recovery-level-pill ${isActive
                                ? `scalp-recovery-level-pill-active scalp-recovery-level-pill-active-${ringTone}`
                                : ""
                                }`}
                            >
                              {level}
                            </span>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {improvementPredictionCards.length > 0 && (
            <section
              className="improvement-prediction-section"
              aria-label="Before and after improvement prediction"
            >
              <div className="title-wrapper">
                <span
                  className="improvement-prediction-icon title-icon-bg"
                  aria-hidden="true"
                >
                  <svg
                    width="15"
                    height="14"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1.5 0V12H13.5V13.5H0V0H1.5ZM12.975 2.475L14.04 3.525L9.75 7.815L7.5 5.565L4.29 8.775L3.225 7.725L7.5 3.435L9.75 5.685L12.975 2.475Z"
                      fill="#00E5FF"
                    />
                  </svg>
                </span>
                <div className="improvement-prediction-header">
                  <h3>Before / After Improvement Prediction</h3>
                  <p>AI-projected outcomes with consistent treatment adherence</p>
                </div>
              </div>

              <div className="improvement-prediction-grid">
                {improvementPredictionCards.map((card) => (
                  <article
                    className="improvement-prediction-card"
                    key={card.period}
                  >
                    <header
                      className={`improvement-prediction-card-head improvement-prediction-card-head-${card.tone}`}
                    >
                      <h4>{card.period}</h4>
                      <span
                        className={`improvement-prediction-phase-chip improvement-prediction-phase-chip-${card.tone}`}
                      >
                        {card.phase}
                      </span>
                    </header>

                    <div className="improvement-prediction-metrics">
                      {card.metrics.map((metric) => (
                        <div
                          className="improvement-metric-row"
                          key={metric.label}
                        >
                          <div className="improvement-metric-head">
                            <p>{metric.label}</p>
                            <strong
                              className={`improvement-metric-value improvement-metric-value-${card.tone}`}
                            >
                              {metric.value}
                            </strong>
                          </div>
                          <div
                            className="improvement-metric-track"
                            aria-hidden="true"
                          >
                            <span
                              className={`improvement-metric-fill improvement-metric-fill-${card.tone}`}
                              style={{ width: `${metric.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <div className="improvement-prediction-disclaimer">
                <span
                  className="improvement-prediction-disclaimer-icon"
                  aria-hidden="true"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8.69358 2.09326L14.767 12.6133C15.0773 13.151 14.6891 13.8232 14.0686 13.8232H1.92175C1.30125 13.8232 0.913015 13.151 1.22328 12.6133L7.29674 2.09326C7.607 1.55554 8.38332 1.55554 8.69358 2.09326Z"
                      fill="#FACC15"
                    />
                    <path
                      d="M8.00016 5.36548C8.39157 5.36548 8.7085 5.68241 8.7085 6.07381V9.13631C8.7085 9.52772 8.39157 9.84465 8.00016 9.84465C7.60876 9.84465 7.29183 9.52772 7.29183 9.13631V6.07381C7.29183 5.68241 7.60876 5.36548 8.00016 5.36548Z"
                      fill="#111827"
                    />
                    <path
                      d="M8.00016 11.6777C8.41437 11.6777 8.75016 11.3419 8.75016 10.9277C8.75016 10.5135 8.41437 10.1777 8.00016 10.1777C7.58595 10.1777 7.25016 10.5135 7.25016 10.9277C7.25016 11.3419 7.58595 11.6777 8.00016 11.6777Z"
                      fill="#111827"
                    />
                  </svg>
                </span>
                <p>
                  Predictions are AI-estimated projections based on your inputs.
                  Actual results vary. Consult a trichologist for clinical
                  guidance.
                </p>
              </div>
            </section>
          )}

          {/* Section: Treatment Recommendation Engine */}
          <section
            className="treatment-engine-section"
            aria-label="Treatment recommendation engine"
          >
            <div className="treatment-engine-header">
              <div className="title-wrapper">
                <span
                  className="treatment-engine-title-icon title-icon-bg"
                  aria-hidden="true"
                >
                  <svg
                    width="19"
                    height="18"
                    viewBox="0 0 19 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5.625 1.875V3.375H4.125V6.375C4.125 6.915 4.26 7.415 4.53 7.875C4.8 8.335 5.165 8.7 5.625 8.97C6.085 9.24 6.585 9.375 7.125 9.375C7.665 9.375 8.165 9.24 8.625 8.97C9.085 8.7 9.45 8.335 9.72 7.875C9.99 7.415 10.125 6.915 10.125 6.375V3.375H8.625V1.875H10.875C11.085 1.875 11.2625 1.9475 11.4075 2.0925C11.5525 2.2375 11.625 2.415 11.625 2.625V6.375C11.625 7.105 11.46 7.79 11.13 8.43C10.81 9.06 10.3625 9.585 9.7875 10.005C9.2125 10.425 8.575 10.695 7.875 10.815V12C7.875 12.48 7.9925 12.92 8.2275 13.32C8.4625 13.72 8.78 14.0375 9.18 14.2725C9.58 14.5075 10.02 14.625 10.5 14.625C11.05 14.625 11.55 14.4675 12 14.1525C12.45 13.8375 12.77 13.43 12.96 12.93C12.56 12.75 12.2375 12.475 11.9925 12.105C11.7475 11.735 11.625 11.325 11.625 10.875C11.625 10.465 11.725 10.0875 11.925 9.7425C12.125 9.3975 12.3975 9.125 12.7425 8.925C13.0875 8.725 13.465 8.625 13.875 8.625C14.285 8.625 14.6625 8.725 15.0075 8.925C15.3525 9.125 15.625 9.3975 15.825 9.7425C16.025 10.0875 16.125 10.465 16.125 10.875C16.125 11.385 15.9725 11.84 15.6675 12.24C15.3625 12.64 14.97 12.905 14.49 13.035C14.34 13.625 14.07 14.155 13.68 14.625C13.29 15.095 12.82 15.4625 12.27 15.7275C11.72 15.9925 11.13 16.125 10.5 16.125C9.75 16.125 9.06 15.94 8.43 15.57C7.8 15.2 7.3 14.7 6.93 14.07C6.56 13.44 6.375 12.75 6.375 12V10.815C5.675 10.695 5.0375 10.425 4.4625 10.005C3.8875 9.585 3.44 9.06 3.12 8.43C2.79 7.79 2.625 7.105 2.625 6.375V2.625C2.625 2.415 2.6975 2.2375 2.8425 2.0925C2.9875 1.9475 3.165 1.875 3.375 1.875H5.625ZM13.875 10.125C13.665 10.125 13.4875 10.1975 13.3425 10.3425C13.1975 10.4875 13.125 10.665 13.125 10.875C13.125 11.085 13.1975 11.2625 13.3425 11.4075C13.4875 11.5525 13.665 11.625 13.875 11.625C14.085 11.625 14.2625 11.5525 14.4075 11.4075C14.5525 11.2625 14.625 11.085 14.625 10.875C14.625 10.665 14.5525 10.4875 14.4075 10.3425C14.2625 10.1975 14.085 10.125 13.875 10.125Z"
                      fill="#00E5FF"
                    />
                  </svg>
                </span>
                <div>
                  <div className="treatment-engine-title-row ">
                    <h3>Treatment Recommendation Engine</h3>
                    <span className="treatment-engine-plan-chip">
                      TREATMENT PLAN
                    </span>
                  </div>
                  <p>
                    Priority-ranked interventions with duration of treatment
                  </p>
                </div>
              </div>
            </div>

            <div className="treatment-engine-list">
              {treatmentRecommendationRows.map((item, itemIndex) => (
                <article className="treatment-engine-card" key={`${asDisplayText(item.title, "Treatment")}-${asDisplayText(item.timeFrame, "1-3 mo")}`}>
                  <div className="treatment-engine-card-top">
                    <div className="treatment-engine-copy">
                      <h4>
                        <span
                          className={`treatment-engine-dot treatment-engine-dot-${asDisplayText(item.markerTone, "medium")}`}
                          aria-hidden="true"
                        />
                        {asDisplayText(item.title, "Treatment")}
                      </h4>
                      <p>{asDisplayText(item.desc, "")}</p>
                    </div>

                    <div className="treatment-engine-side">
                      {toBooleanFlag(item.showImage, true) && (
                        <div
                          className="treatment-engine-image"
                          style={{
                            backgroundImage: `url(${treatmentRecommendationImages[itemIndex % treatmentRecommendationImages.length] || scalpRepresentativeImage})`,
                          }}
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`treatment-engine-priority treatment-engine-priority-${asDisplayText(item.priorityTone, "medium")}`}
                      >
                        {asDisplayText(item.priority, "MEDIUM")}
                      </span>
                    </div>
                  </div>

                  <div className="treatment-engine-meta-grid">
                    <div className="treatment-engine-meta-card treatment-engine-meta-card-time">
                      <p>TIME FRAME</p>
                      <h5>{asDisplayText(item.timeFrame, "1-3 mo")}</h5>
                    </div>
                    <div className="treatment-engine-meta-card-nobg treatment-engine-meta-card-duration ">
                      <p>DURATION</p>
                      <h5>{asDisplayText(item.duration, "Ongoing")}</h5>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Section: Personalised 12-Month Treatment Plan */}
          <section
            className="personalised-plan-section"
            aria-label="Personalised 12 month treatment plan"
          >
            <div className="title-wrapper">
              <span className="title-icon-bg" aria-hidden="true">
                <svg
                  width="19"
                  height="18"
                  viewBox="0 0 19 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M14.625 1.5V3H13.125V5.25C13.535 5.25 13.9125 5.35 14.2575 5.55C14.6025 5.75 14.875 6.0225 15.075 6.3675C15.275 6.7125 15.375 7.09 15.375 7.5V15.75C15.375 15.96 15.3025 16.1375 15.1575 16.2825C15.0125 16.4275 14.835 16.5 14.625 16.5H4.125C3.915 16.5 3.7375 16.4275 3.5925 16.2825C3.4475 16.1375 3.375 15.96 3.375 15.75V7.5C3.375 7.09 3.475 6.7125 3.675 6.3675C3.875 6.0225 4.1475 5.75 4.4925 5.55C4.8375 5.35 5.215 5.25 5.625 5.25V3H4.125V1.5H14.625ZM13.125 6.75H5.625C5.415 6.75 5.2375 6.8225 5.0925 6.9675C4.9475 7.1125 4.875 7.29 4.875 7.5V15H13.875V7.5C13.875 7.29 13.8025 7.1125 13.6575 6.9675C13.5125 6.8225 13.335 6.75 13.125 6.75ZM10.125 8.25V9.75H11.625V11.25H10.125V12.75H8.625V11.25H7.125V9.75H8.625V8.25H10.125ZM11.625 3H7.125V5.25H11.625V3Z"
                    fill="#00E5FF"
                  />
                </svg>
              </span>
              <div className="personalised-plan-header">
                <p className="personalised-plan-kicker">Section 9</p>
                <h3>Personalised 12-Month Treatment Plan</h3>
                <p className="personalised-plan-subtitle">
                  Phase-wise treatment roadmap
                </p>
              </div>
            </div>

            <div className="personalised-plan-wrap">
              {phases.map((phaseItem, phaseIndex) => (
                <article
                  className={`personalised-phase-card personalised-phase-card-${phaseItem.tone}`}
                  key={phaseItem.phase}
                >
                  <div className="personalised-phase-top">
                    <div className="personalised-phase-headline-wrap">
                      <span
                        className={`personalised-phase-icon personalised-phase-icon-${phaseItem.tone}`}
                        aria-hidden="true"
                      >
                        {phaseItem.icon === "shield" && (
                          <svg
                            width="17"
                            height="16"
                            viewBox="0 0 17 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M2.85158 1.88016L8.32816 0.666829L13.8047 1.88016C13.9558 1.91572 14.0801 1.99572 14.1778 2.12016C14.2756 2.24461 14.3244 2.38238 14.3244 2.5335V9.18683C14.3244 9.86238 14.1667 10.4935 13.8514 11.0802C13.536 11.6668 13.0985 12.1468 12.5389 12.5202L8.32816 15.3335L4.11746 12.5202C3.55781 12.1468 3.12031 11.6668 2.80495 11.0802C2.48959 10.4935 2.33191 9.86238 2.33191 9.18683V2.5335C2.33191 2.38238 2.38077 2.24461 2.47848 2.12016C2.5762 1.99572 2.70057 1.91572 2.85158 1.88016ZM3.66441 3.06683V9.18683C3.66441 9.64016 3.76879 10.0624 3.97755 10.4535C4.18631 10.8446 4.47723 11.1646 4.85033 11.4135L8.32816 13.7335L11.806 11.4135C12.1791 11.1646 12.47 10.8446 12.6788 10.4535C12.8875 10.0624 12.9919 9.64016 12.9919 9.18683V3.06683L8.32816 2.02683L3.66441 3.06683ZM8.99441 6.66683H10.9932L7.66191 11.3335V8.00016H5.66316L8.99441 3.3335V6.66683Z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                        {phaseItem.icon === "sprout" && (
                          <svg
                            width="17"
                            height="16"
                            viewBox="0 0 17 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M4.33065 2C5.09462 2 5.80972 2.17333 6.47597 2.52C7.12446 2.85778 7.66856 3.32667 8.10829 3.92667C8.54801 4.52667 8.82562 5.19556 8.9411 5.93333C9.34085 5.53333 9.79834 5.22222 10.3136 5C10.8466 4.77778 11.4062 4.66667 11.9925 4.66667H14.9906V6.33333C14.9906 7.11556 14.7952 7.84444 14.4043 8.52C14.0224 9.17778 13.5027 9.69778 12.8453 10.08C12.1702 10.4711 11.4418 10.6667 10.66 10.6667H8.9944V14H7.6619V8.66667H6.3294C5.48548 8.66667 4.69931 8.45333 3.97087 8.02667C3.26909 7.61778 2.71388 7.06222 2.30525 6.36C1.87885 5.63111 1.66565 4.84444 1.66565 4V2H4.33065ZM13.6581 6H11.9925C11.4506 6 10.951 6.13556 10.4935 6.40667C10.036 6.67778 9.67175 7.04222 9.40081 7.5C9.12987 7.95778 8.9944 8.45778 8.9944 9V9.33333H10.66C11.2019 9.33333 11.7016 9.19778 12.1591 8.92667C12.6166 8.65556 12.9808 8.29111 13.2517 7.83333C13.5227 7.37556 13.6581 6.87556 13.6581 6.33333V6ZM4.33065 3.33333H2.99815V4C2.99815 4.60444 3.14695 5.16222 3.44454 5.67333C3.74213 6.18444 4.14632 6.58889 4.65711 6.88667C5.1679 7.18444 5.72533 7.33333 6.3294 7.33333H7.6619V6.66667C7.6619 6.06222 7.5131 5.50444 7.21551 4.99333C6.91792 4.48222 6.51373 4.07778 6.00294 3.78C5.49215 3.48222 4.93472 3.33333 4.33065 3.33333Z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                        {phaseItem.icon === "star" && (
                          <svg
                            width="17"
                            height="16"
                            viewBox="0 0 17 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M8.32818 12.6002L3.62445 15.2402L4.67713 9.9469L0.719604 6.29357L6.07625 5.65357L8.32818 0.760235L10.5801 5.65357L15.9368 6.29357L11.9792 9.9469L13.0319 15.2402L8.32818 12.6002ZM8.32818 11.0802L11.1531 12.6669L10.5268 9.48023L12.912 7.28023L9.68733 6.89357L8.32818 3.9469L6.96903 6.89357L3.74438 7.28023L6.12955 9.48023L5.50328 12.6669L8.32818 11.0802Z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                      </span>
                      <h4>
                        {phaseItem.phase} - {phaseItem.monthRange}
                        <span>{phaseItem.subtitle}</span>
                      </h4>
                    </div>

                    <div
                      className="personalised-phase-image"
                      style={{
                        backgroundImage: `url(${section9PhaseImages[phaseIndex % section9PhaseImages.length] || scalpRepresentativeImage})`,
                      }}
                      aria-hidden="true"
                    />
                  </div>

                  <ul
                    className={`personalised-phase-list personalised-phase-list-${phaseItem.tone}`}
                  >
                    {phaseItem.bullets.map((bullet) => (
                      <li key={bullet}>
                        <span
                          className="personalised-phase-bullet"
                          aria-hidden="true"
                        />
                        <p>{bullet}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          {/* Section:  Lifestyle Assessment  */}
          <section
            className="lifestyle-risk-section"
            aria-label="Lifestyle risk breakdown"
          >
            <header className="lifestyle-risk-header">
              <span className="title-icon-bg" aria-hidden="true">
                <svg
                  width="19"
                  height="18"
                  viewBox="0 0 19 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M13.125 2.05469C13.875 2.05469 14.565 2.24969 15.195 2.63969C15.825 3.02969 16.32 3.55969 16.68 4.22969C17.06 4.92969 17.25 5.70469 17.25 6.55469C17.25 7.71469 16.98 8.82969 16.44 9.89969C15.98 10.8097 15.325 11.6847 14.475 12.5247C13.815 13.1847 13.03 13.8297 12.12 14.4597C11.61 14.8097 10.94 15.2297 10.11 15.7197L9.75 15.9297L9.39 15.7197C8.52 15.2097 7.82 14.7697 7.29 14.3997C6.34 13.7397 5.525 13.0597 4.845 12.3597C3.985 11.4597 3.335 10.5297 2.895 9.56969L1.5 9.55469V8.05469L2.415 8.06969C2.305 7.56969 2.25 7.06469 2.25 6.55469C2.25 5.70469 2.44 4.92969 2.82 4.22969C3.18 3.55969 3.675 3.02969 4.305 2.63969C4.935 2.24969 5.625 2.05469 6.375 2.05469C7.025 2.05469 7.67 2.21469 8.31 2.53469C8.85 2.79469 9.33 3.13469 9.75 3.55469C10.17 3.13469 10.65 2.79469 11.19 2.53469C11.83 2.21469 12.475 2.05469 13.125 2.05469ZM13.125 3.55469C12.725 3.55469 12.32 3.65219 11.91 3.84719C11.5 4.04219 11.135 4.29969 10.815 4.61969L9.75 5.68469L8.685 4.61969C8.365 4.29969 8 4.04219 7.59 3.84719C7.18 3.65219 6.775 3.55469 6.375 3.55469C5.895 3.55469 5.455 3.68469 5.055 3.94469C4.655 4.20469 4.3375 4.56219 4.1025 5.01719C3.8675 5.47219 3.75 5.98969 3.75 6.56969C3.75 7.06969 3.815 7.56969 3.945 8.06969L5.58 8.05469L7.125 5.47469L9.375 9.22469L10.08 8.05469H13.5V9.55469H10.92L9.375 12.1497L7.125 8.39969L6.42 9.55469L4.575 9.56969C5.155 10.5697 6.04 11.5447 7.23 12.4947C7.76 12.9147 8.365 13.3397 9.045 13.7697C9.255 13.8997 9.49 14.0397 9.75 14.1897C10.01 14.0397 10.245 13.8997 10.455 13.7697C11.135 13.3397 11.74 12.9147 12.27 12.4947C13.41 11.5847 14.27 10.6497 14.85 9.68969C15.45 8.68969 15.75 7.64969 15.75 6.56969C15.75 5.98969 15.635 5.46969 15.405 5.00969C15.175 4.54969 14.86 4.19469 14.46 3.94469C14.06 3.69469 13.615 3.56469 13.125 3.55469Z"
                    fill="#00E5FF"
                  />
                </svg>
              </span>
              <div className="lifestyle-risk-head-copy">
                <p className="lifestyle-risk-kicker">Lifestyle Assessment</p>
                <h3>Lifestyle Risk Breakdown</h3>
                <p>Behavioural contributors to hair loss scored individually</p>
              </div>
            </header>

            <div className="lifestyle-risk-grid">
              {lifestyleRiskFactors.map((item) => (
                <article className="lifestyle-risk-card" key={item.label}>
                  <div className="lifestyle-risk-card-head">
                    <h4>{item.label}</h4>
                    <span
                      className={`lifestyle-risk-pill lifestyle-risk-pill-${item.tone}`}
                    >
                      {item.tag}
                    </span>
                  </div>
                  <div className="lifestyle-risk-track" aria-hidden="true">
                    <span
                      className={`lifestyle-risk-fill lifestyle-risk-fill-${item.tone}`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>

            <article className="lifestyle-impact-card">
              <div className="lifestyle-impact-main">
                <span className="lifestyle-impact-icon" aria-hidden="true">
                  <svg
                    width="17"
                    height="16"
                    viewBox="0 0 17 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6.32928 1.64033V3.05366C5.68079 3.32033 5.10338 3.70033 4.59703 4.19366C4.09068 4.68699 3.69981 5.25366 3.42443 5.89366C3.14016 6.56921 2.99803 7.27144 2.99803 8.00033C2.99803 8.96921 3.24232 9.86699 3.7309 10.6937C4.20172 11.4937 4.83688 12.1292 5.63638 12.6003C6.46253 13.0892 7.35974 13.3337 8.32803 13.3337C9.05646 13.3337 9.75824 13.1914 10.4334 12.907C11.073 12.6314 11.6393 12.2403 12.1323 11.7337C12.6253 11.227 13.0051 10.6492 13.2716 10.0003H14.6841C14.3998 10.8981 13.9467 11.7003 13.3249 12.407C12.7031 13.1137 11.9658 13.6625 11.113 14.0537C10.2335 14.4625 9.30519 14.667 8.32803 14.667C7.42193 14.667 6.5558 14.4937 5.72965 14.147C4.93904 13.8092 4.23503 13.3314 3.61764 12.7137C3.00025 12.0959 2.52277 11.3914 2.1852 10.6003C1.83875 9.77366 1.66553 8.90699 1.66553 8.00033C1.66553 7.02255 1.86984 6.09366 2.27848 5.21366C2.66934 4.36033 3.21789 3.62255 3.92411 3.00033C4.63034 2.3781 5.43206 1.92477 6.32928 1.64033ZM8.32803 1.33366C9.23413 1.33366 10.1003 1.50699 10.9264 1.85366C11.717 2.19144 12.421 2.66922 13.0384 3.28699C13.6558 3.90477 14.1333 4.60921 14.4709 5.40033C14.8173 6.22699 14.9905 7.09366 14.9905 8.00033C14.9905 8.22255 14.9816 8.44477 14.9639 8.66699H7.66178V1.36033C7.88386 1.34255 8.10594 1.33366 8.32803 1.33366ZM8.99428 2.70699V7.33366H13.6181C13.5203 6.54255 13.2583 5.81144 12.8319 5.14033C12.4055 4.46921 11.8569 3.92033 11.1862 3.49366C10.5155 3.06699 9.78489 2.80477 8.99428 2.70699Z"
                      fill="#FACC15"
                    />
                  </svg>
                </span>
                <div className="lifestyle-impact-copy">
                  <h4>Lifestyle Impact Score</h4>
                  <p>
                    {asDisplayText(clinicalNarrative?.lifestyleImpact, "Lifestyle factors appear to be a contributing factor - addressing these can reduce hair loss risk significantly.")}
                  </p>
                </div>
              </div>
              <div
                className="lifestyle-impact-image"
                style={{ backgroundImage: `url(${lifestyleImpactImage})` }}
                aria-hidden="true"
              />
            </article>
          </section>

          {/* Section: Nutritional Protocol */}
          <section
            className="nutritional-protocol-section"
            aria-label="Nutritional protocol"
          >
            <header className="nutritional-protocol-header">
              <span
                className="nutritional-protocol-title-icon"
                aria-hidden="true"
              >
                <svg
                  width="19"
                  height="18"
                  viewBox="0 0 19 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M16.125 1.5V16.5H14.625V11.25H11.625V6C11.625 5.19 11.83 4.435 12.24 3.735C12.64 3.055 13.18 2.515 13.86 2.115C14.56 1.705 15.315 1.5 16.125 1.5ZM14.625 3.39C14.235 3.61 13.905 3.92 13.635 4.32C13.295 4.82 13.125 5.38 13.125 6V9.75H14.625V3.39ZM7.125 10.425V16.5H5.625V10.425C5.055 10.315 4.5425 10.0825 4.0875 9.7275C3.6325 9.3725 3.275 8.935 3.015 8.415C2.755 7.895 2.625 7.34 2.625 6.75V2.25H4.125V7.5H5.625V2.25H7.125V7.5H8.625V2.25H10.125V6.75C10.125 7.34 9.995 7.895 9.735 8.415C9.475 8.935 9.1175 9.3725 8.6625 9.7275C8.2075 10.0825 7.695 10.315 7.125 10.425Z"
                    fill="#00E5FF"
                  />
                </svg>
              </span>
              <div className="nutritional-protocol-head-copy">
                <p className="nutritional-protocol-kicker">
                  Nutritional Protocol
                </p>
                <h3>Diet &amp; Nutrition Guidance</h3>
              </div>
            </header>

            <article className="nutritional-protocol-panel">
              <div className="nutritional-panel-title-row">
                <span
                  className="nutritional-panel-title-icon"
                  aria-hidden="true"
                >
                  <svg
                    width="15"
                    height="14"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12.5373 1.45866V2.62533C12.5373 4.42977 12.2185 5.96588 11.5809 7.23366C10.99 8.41588 10.1542 9.31033 9.0735 9.91699C8.0472 10.5003 6.86929 10.792 5.53977 10.792H3.34722C3.25392 11.3209 3.20727 11.9042 3.20727 12.542H2.04102C2.04102 11.7487 2.1071 11.0214 2.23928 10.3603C2.1071 9.60588 2.04102 8.5831 2.04102 7.29199C2.04102 6.49866 2.19263 5.74033 2.49585 5.01699C2.7913 4.32477 3.20921 3.70838 3.74957 3.16783C4.28993 2.62727 4.9061 2.20921 5.59808 1.91366C6.32115 1.61033 7.07922 1.45866 7.87227 1.45866C8.10552 1.45866 8.47094 1.49755 8.96854 1.57533C9.37284 1.63755 9.69162 1.67644 9.92487 1.69199C10.3214 1.7231 10.7101 1.72699 11.0911 1.70366C11.5498 1.66477 12.0319 1.5831 12.5373 1.45866ZM7.87227 2.62533C7.02479 2.62533 6.23952 2.83921 5.51644 3.26699C4.81669 3.67921 4.26078 4.23533 3.8487 4.93533C3.42108 5.65866 3.20727 6.44421 3.20727 7.29199V7.89866C3.56492 7.33866 4.01587 6.81755 4.56012 6.33533C5.08104 5.87644 5.69915 5.44477 6.41445 5.04033L6.99758 6.04366C6.13455 6.54144 5.43869 7.06644 4.90999 7.61866C4.35019 8.20199 3.93423 8.87088 3.6621 9.62533H5.53977C6.71379 9.62533 7.73426 9.36866 8.60117 8.85533C9.46808 8.34199 10.1348 7.58755 10.6013 6.59199C11.0911 5.55755 11.3477 4.30921 11.371 2.84699C10.9823 2.88588 10.5857 2.89755 10.1814 2.88199C9.81602 2.85866 9.39228 2.81199 8.91023 2.74199C8.56813 2.68755 8.33877 2.65449 8.22214 2.64283C8.10552 2.63116 7.98889 2.62533 7.87227 2.62533Z"
                      fill="#00E5FF"
                    />
                  </svg>
                </span>
                <h4>Critical Nutrients for Hair Growth</h4>
              </div>


              {fullReport ? (
                <div className="nutritional-card-grid">
                  {nutritionalProtocolCards.map((item) => (
                    <article className="nutritional-card" key={item.title}>
                      <div className="nutritional-card-head">
                        <span className={`nutritional-card-icon nutritional-card-icon-${item.tone}`}>
                          {item.icon === "chain" && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5 4 14l6.5-6.5 6.5 6.5-6.5 6.5z"></path><path d="M10.5 20.5 20.5 10.5 14 4"></path></svg>
                          )}
                          {item.icon === "drop" && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                          )}
                          {item.icon === "shield" && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          )}
                          {item.icon === "sun" && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                          )}
                        </span>
                        <div className="nutritional-card-title-wrap">
                          <h5>{item.title}</h5>
                          <p className={`nutritional-dose nutritional-dose-${item.tone}`}>{item.dosage}</p>
                        </div>
                      </div>
                      {(item.imageType === "biotin" || item.imageType === "egg" || item.imageType === "iron") && (
                        <div
                          className="nutritional-card-image"
                          style={{
                            backgroundImage: `url(${item.imageType === "iron" ? nutritionalIronImage : nutritionalEggImage})`,
                          }}
                        />
                      )}
                      <div className="nutritional-card-body-layout">
                        <p className="nutritional-card-desc">{item.desc}</p>
                        <div className="nutritional-bottom-row">
                          <ul className="nutritional-food-list">
                            {item.foods.map((food) => (
                              <li key={food} className={`nutritional-food-pill nutritional-food-pill-${item.tone || 'cyan'}`}>{food}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="nutritional-card-grid">
                  {nutritionalProtocolCards.map((item) => (
                    <article className="nutritional-card" key={item.title}>
                      <div className="nutritional-card-head">
                        <span className={`nutritional-card-icon nutritional-card-icon-${item.tone}`}>
                          {item.icon === "chain" && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5 4 14l6.5-6.5 6.5 6.5-6.5 6.5z"></path><path d="M10.5 20.5 20.5 10.5 14 4"></path></svg>
                          )}
                          {item.icon === "drop" && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                          )}
                          {item.icon === "shield" && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          )}
                          {item.icon === "sun" && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                          )}
                        </span>
                        <div className="nutritional-card-title-wrap">
                          <h5>{item.title}</h5>
                          <p className={`nutritional-dose nutritional-dose-${item.tone}`}>{item.dosage}</p>
                        </div>
                      </div>
                      {(item.imageType === "biotin" || item.imageType === "egg" || item.imageType === "iron") && (
                        <div
                          className="nutritional-card-image"
                          style={{
                            backgroundImage: `url(${item.imageType === "iron" ? nutritionalIronImage : nutritionalEggImage})`,
                          }}
                        />
                      )}
                      <div className="nutritional-card-body-layout">
                        <p className="nutritional-card-desc">{item.desc}</p>
                        <div className="nutritional-bottom-row">
                          <ul className="nutritional-food-list">
                            {item.foods.map((food, i) => (
                              <li key={i} className={`nutritional-food-pill nutritional-food-pill-${item.tone || 'cyan'}`}>{food}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </article>
                  ))}
                  <UnlockOverlay
                    title="Unlock Complete Nutrient Plan"
                    description="Get exact dosage, absorption strategy, and personalized recommendations."
                    ctaText="Unlock Full Nutrition Plan"
                    onUnlock={handleUnlockReport}
                  />
                </div>
              )}
            </article>
          </section>

          {/* Section: Sample Daily Meal Plan */}
          <section
            className="meal-plan-section"
            aria-label="Sample daily meal plan"
          >
            <article className="meal-plan-panel">
              <h4>
                <span className="meal-plan-title-icon" aria-hidden="true">
                  <svg
                    width="15"
                    height="14"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5.53988 1.16634V2.33301H9.03863V1.16634H10.2049V2.33301H12.5374C12.7007 2.33301 12.8387 2.3894 12.9514 2.50217C13.0641 2.61495 13.1205 2.75301 13.1205 2.91634V12.2497C13.1205 12.413 13.0641 12.5511 12.9514 12.6638C12.8387 12.7766 12.7007 12.833 12.5374 12.833H2.04113C1.87786 12.833 1.73985 12.7766 1.62711 12.6638C1.51438 12.5511 1.45801 12.413 1.45801 12.2497V2.91634C1.45801 2.75301 1.51438 2.61495 1.62711 2.50217C1.73985 2.3894 1.87786 2.33301 2.04113 2.33301H4.37363V1.16634H5.53988ZM11.9543 6.99967H2.62426V11.6663H11.9543V6.99967ZM4.37363 3.49967H2.62426V5.83301H11.9543V3.49967H10.2049V4.66634H9.03863V3.49967H5.53988V4.66634H4.37363V3.49967Z"
                      fill="#00E5FF"
                    />
                  </svg>
                </span>
                Sample Daily Meal Plan
              </h4>

              {fullReport ? (
                <div className="meal-plan-list">
                  {dailyMealPlanRows.map((item) => (
                    <article className="meal-plan-row" key={item.meal}>
                      <div className={`meal-plan-row-icon meal-plan-row-icon-${item.tone || 'cyan'}`}>
                        {MealTypeIcon({ type: item.icon, color: "currentColor", size: 13 })}
                      </div>
                      <p>
                        <strong className={`meal-plan-label meal-plan-label-${item.tone || 'cyan'}`}>{item.meal}</strong>
                        <span>{item.items ? item.items.join(", ") : item.detail}</span>
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="meal-plan-list">
                  {dailyMealPlanRows.map((item) => (
                    <article className="meal-plan-row" key={item.meal}>
                      <div className={`meal-plan-row-icon meal-plan-row-icon-${item.tone || 'cyan'}`}>
                        {MealTypeIcon({ type: item.icon, color: "currentColor", size: 13 })}
                      </div>
                      <p>
                        <strong className={`meal-plan-label meal-plan-label-${item.tone || 'cyan'}`}>{item.meal}</strong>
                        <span>{item.items ? item.items.join(", ") : item.detail}</span>
                      </p>
                    </article>
                  ))}
                  <UnlockOverlay
                    title="Unlock Personalized Meal Plan"
                    description="Get a day-by-day diet plan tailored to your hair recovery needs."
                    ctaText="Unlock Full Plan"
                    onUnlock={handleUnlockReport}
                  />
                </div>
              )}
            </article>
          </section>

          {/* Section: Foods & Habits to Avoid */}
          <section
            className="avoid-habits-section"
            aria-label="Foods and habits to avoid"
          >
            <article className="avoid-habits-panel">
              <h4>
                <span className="avoid-habits-title-icon" aria-hidden="true">
                  <svg
                    width="15"
                    height="14"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4.43195 3.31301L10.9746 9.85801C11.2856 9.46134 11.5266 9.0219 11.6977 8.53967C11.8687 8.0419 11.9543 7.52856 11.9543 6.99967C11.9543 6.1519 11.7404 5.36634 11.3128 4.64301C10.9007 3.94301 10.3448 3.3869 9.64508 2.97467C8.92201 2.5469 8.13673 2.33301 7.28926 2.33301C6.76056 2.33301 6.24741 2.41856 5.74981 2.58967C5.26776 2.76079 4.82847 3.0019 4.43195 3.31301ZM10.1466 10.6863L3.60391 4.14134C3.29291 4.53801 3.05188 4.97745 2.88083 5.45967C2.70978 5.95745 2.62426 6.47079 2.62426 6.99967C2.62426 7.84745 2.83807 8.63301 3.2657 9.35634C3.67777 10.0563 4.23368 10.6125 4.93343 11.0247C5.65651 11.4525 6.44178 11.6663 7.28926 11.6663C7.81796 11.6663 8.33111 11.5808 8.82871 11.4097C9.31076 11.2386 9.75004 10.9975 10.1466 10.6863ZM3.16073 2.86967C3.70498 2.33301 4.3231 1.9169 5.01507 1.62134C5.73815 1.31801 6.49621 1.16634 7.28926 1.16634C8.08231 1.16634 8.84037 1.31801 9.56345 1.62134C10.2554 1.9169 10.8716 2.33495 11.412 2.87551C11.9523 3.41606 12.3702 4.03245 12.6657 4.72467C12.9689 5.44801 13.1205 6.20634 13.1205 6.99967C13.1205 7.79301 12.9689 8.55134 12.6657 9.27467C12.3702 9.9669 11.9523 10.5833 11.412 11.1238C10.8716 11.6644 10.2554 12.0825 9.56345 12.378C8.84037 12.6813 8.08231 12.833 7.28926 12.833C6.49621 12.833 5.73815 12.6813 5.01507 12.378C4.3231 12.0825 3.70693 11.6644 3.16656 11.1238C2.6262 10.5833 2.2083 9.9669 1.91285 9.27467C1.60962 8.55134 1.45801 7.79301 1.45801 6.99967C1.45801 6.20634 1.60962 5.44801 1.91285 4.72467C2.2083 4.03245 2.62426 3.41412 3.16073 2.86967Z"
                      fill="#EF4444"
                    />
                  </svg>
                </span>
                Foods &amp; Habits to Avoid
              </h4>

              {fullReport ? (
                <div className="avoid-habits-grid">
                  {foodsHabitsToAvoid.map((item) => (
                    <article className={`avoid-habit-card avoid-habit-card-${item.tone || 'danger'}`} key={item.title}>
                      <div className="avoid-habit-head">
                        <span className={`avoid-habit-icon avoid-habit-icon-${item.tone || 'danger'}`}>
                          {AvoidIcon({ tone: item.tone, size: 13 })}
                        </span>
                        <h5>{item.title}</h5>
                      </div>
                      <p>{item.explanation || item.detail}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="avoid-habits-grid">
                  {foodsHabitsToAvoid.map((item) => (
                    <article className={`avoid-habit-card avoid-habit-card-${item.tone || 'danger'}`} key={item.title}>
                      <div className="avoid-habit-head">
                        <span className={`avoid-habit-icon avoid-habit-icon-${item.tone || 'danger'}`}>
                          {AvoidIcon({ tone: item.tone, size: 13 })}
                        </span>
                        <h5>{item.title}</h5>
                      </div>
                      <p>{item.explanation || item.detail}</p>
                    </article>
                  ))}
                  <UnlockOverlay
                    title="Unlock Avoidance Guide"
                    description="Detailed breakdown of hidden dietary triggers and habits slowing your recovery."
                    ctaText="Unlock Full Plan"
                    onUnlock={handleUnlockReport}
                  />
                </div>
              )}
            </article>
          </section>

          {/* Section: Daily Protocol */}
          <section
            className="daily-protocol-section"
            aria-label="Lifestyle and daily routine guidance"
          >
            <header className="daily-protocol-header">
              <span className="daily-protocol-title-icon" aria-hidden="true">
                <svg
                  width="19"
                  height="18"
                  viewBox="0 0 19 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7.125 1.5V3H11.625V1.5H13.125V3H16.125C16.335 3 16.5125 3.0725 16.6575 3.2175C16.8025 3.3625 16.875 3.54 16.875 3.75V15.75C16.875 15.96 16.8025 16.1375 16.6575 16.2825C16.5125 16.4275 16.335 16.5 16.125 16.5H2.625C2.415 16.5 2.2375 16.4275 2.0925 16.2825C1.9475 16.1375 1.875 15.96 1.875 15.75V3.75C1.875 3.54 1.9475 3.3625 2.0925 3.2175C2.2375 3.0725 2.415 3 2.625 3H5.625V1.5H7.125ZM15.375 8.25H3.375V15H15.375V8.25ZM11.655 9.105L12.705 10.17L9 13.875L6.345 11.22L7.41 10.17L9 11.76L11.655 9.105ZM5.625 4.5H3.375V6.75H15.375V4.5H13.125V5.25H11.625V4.5H7.125V5.25H5.625V4.5Z"
                    fill="#00E5FF"
                  />
                </svg>
              </span>
              <div className="daily-protocol-head-copy">
                <p>Daily Protocol</p>
                <h3>Lifestyle &amp; Daily Routine Guidance</h3>
              </div>
            </header>

            <article className="daily-routine-panel">
              <div className="daily-routine-top-row">
                <h4>Daily Hair Care Routine</h4>
                <span className="daily-routine-priority">
                  Standard Priority
                </span>
              </div>

              <div className="daily-routine-list">
                {dailyRoutineItems.map((item) => (
                  <article
                    className={`daily-routine-row ${item.highlight ? " daily-routine-row-highlight" : ""}`}
                    key={item.label}
                  >
                    <span className="daily-routine-dot" aria-hidden="true" style={{ color: "#00E5FF" }}>
                      <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
                        <circle cx="3" cy="3" r="3" />
                      </svg>
                    </span>
                    <p>
                      <span className="daily-routine-label">{item.label}</span>
                      <strong className="daily-routine-label-title">{item.action}</strong>
                      {item.note && <span className="daily-routine-note">— {item.note}</span>}
                    </p>
                  </article>
                ))}
              </div>
            </article>

            <article className="weekly-schedule-panel">
              <h4>Weekly Hair Care Schedule</h4>
              {fullReport ? (
                <div className="weekly-schedule-grid">
                  {weeklyHairSchedule.map((day) => (
                    <article className="weekly-day-card" key={day.day}>
                      <div className="weekly-day-head">
                        <h5>{day.day}</h5>
                        <span className="weekly-day-lock" aria-hidden="true">
                          {weeklyDayLockIcon}
                        </span>
                      </div>
                      <ul>
                        {day.tasks.map((task) => (
                          <li key={task}>
                            <span className="weekly-task-dot" aria-hidden="true">
                              <svg
                                width="4"
                                height="4"
                                viewBox="0 0 4 4"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M0 2C0 0.895431 0.895431 0 2 0C3.10457 0 4 0.895431 4 2C4 3.10457 3.10457 4 2 4C0.895431 4 0 3.10457 0 2Z"
                                  fill="#00E5FF"
                                  fillOpacity="0.7"
                                />
                              </svg>
                            </span>
                            <span>{task}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="weekly-schedule-grid">
                  {weeklyHairSchedule.map((day) => (
                    <article className="weekly-day-card" key={day.day}>
                      <div className="weekly-day-head">
                        <h5>{day.day}</h5>
                        <span className="weekly-day-lock" aria-hidden="true">
                          {weeklyDayLockIcon}
                        </span>
                      </div>
                      <ul>
                        {day.tasks.map((task) => (
                          <li key={task}>
                            <span className="weekly-task-dot" aria-hidden="true">
                              <svg
                                width="4"
                                height="4"
                                viewBox="0 0 4 4"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M0 2C0 0.895431 0.895431 0 2 0C3.10457 0 4 0.895431 4 2C4 3.10457 3.10457 4 2 4C0.895431 4 0 3.10457 0 2Z"
                                  fill="#00E5FF"
                                  fillOpacity="0.7"
                                />
                              </svg>
                            </span>
                            <span>{task}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                  {!fullReport && (
                    <UnlockOverlay
                      title="Unlock Your Personalized Weekly Routine"
                      description="Get a structured day-by-day plan tailored to your hair recovery journey."
                      onUnlock={handleUnlockReport}
                    />
                  )}
                </div>
              )}
            </article>
          </section>

          {/* Section: stress Protocol */}
          <section
            className="stress-protocol-section"
            aria-label="Stress management protocol"
          >
            <header className="stress-protocol-header">
              <span className="stress-protocol-title-icon" aria-hidden="true">
                <svg
                  width="19"
                  height="18"
                  viewBox="0 0 19 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8.52002 1.5C9.52002 1.5 10.46 1.735 11.34 2.205C12.19 2.655 12.8925 3.2775 13.4475 4.0725C14.0025 4.8675 14.345 5.75 14.475 6.72L16.155 9.375C16.225 9.475 16.245 9.5775 16.215 9.6825C16.185 9.7875 16.11 9.87 15.99 9.93L14.52 10.56V12.75C14.52 13.02 14.4525 13.27 14.3175 13.5C14.1825 13.73 14 13.9125 13.77 14.0475C13.54 14.1825 13.29 14.25 13.02 14.25H11.52V16.5H4.77002V13.725C4.77002 12.855 4.46002 12.03 3.84002 11.25C3.42002 10.73 3.10002 10.155 2.88002 9.525C2.64002 8.875 2.52002 8.2 2.52002 7.5C2.52002 6.41 2.79502 5.4 3.34502 4.47C3.87502 3.57 4.59002 2.855 5.49002 2.325C6.43002 1.775 7.44002 1.5 8.52002 1.5ZM8.52002 3C7.71002 3 6.95502 3.205 6.25502 3.615C5.57502 4.015 5.03502 4.555 4.63502 5.235C4.22502 5.935 4.02002 6.69 4.02002 7.5C4.02002 8.02 4.10502 8.52 4.27502 9C4.44502 9.48 4.69002 9.915 5.01002 10.305C5.85002 11.365 6.27002 12.505 6.27002 13.725V15H10.02V12.75H13.02V9.57L14.19 9.06L13.035 7.245L12.99 6.915C12.89 6.185 12.63 5.52 12.21 4.92C11.79 4.32 11.2575 3.85 10.6125 3.51C9.96752 3.17 9.27002 3 8.52002 3ZM8.13002 5.82L8.52002 6.225L8.92502 5.82C9.17502 5.57 9.48252 5.445 9.84752 5.445C10.2125 5.445 10.5225 5.5725 10.7775 5.8275C11.0325 6.0825 11.16 6.39 11.16 6.75C11.16 7.11 11.035 7.42 10.785 7.68L8.52002 9.93L6.27002 7.68C6.01002 7.42 5.88002 7.11 5.88002 6.75C5.88002 6.39 6.01002 6.0825 6.27002 5.8275C6.53002 5.5725 6.84002 5.445 7.20002 5.445C7.56002 5.445 7.87002 5.57 8.13002 5.82Z"
                    fill="#00E5FF"
                  />
                </svg>
              </span>
              <div className="stress-protocol-head-copy">
                <p>Stress Protocol</p>
                <h3>Stress Management Protocol</h3>
                <span>
                  Cortisol reduction plan to halt stress-induced hair loss
                </span>
              </div>
            </header>

            <article className="stress-cortisol-card">
              <div className="stress-cortisol-main">
                <div className="stress-cortisol-top">
                  <div className="stress-cortisol-title-wrap">
                    <span className="stress-cortisol-icon" aria-hidden="true">
                      <svg
                        width="15"
                        height="14"
                        viewBox="0 0 15 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M5.53988 2.33301C5.74981 2.33301 5.94418 2.38551 6.12301 2.49051C6.30183 2.59551 6.44373 2.73745 6.54869 2.91634C6.65365 3.09523 6.70613 3.28967 6.70613 3.49967V7.47801C6.21631 7.10467 5.5671 6.8519 4.7585 6.71967L4.5719 7.86301C5.32607 7.99523 5.87032 8.24217 6.20465 8.60384C6.53897 8.96551 6.70613 9.50023 6.70613 10.208C6.70613 10.4725 6.64005 10.7155 6.50787 10.9372C6.3757 11.1588 6.19881 11.3358 5.97723 11.468C5.75564 11.6002 5.51267 11.6663 5.24832 11.6663C4.98397 11.6663 4.741 11.6002 4.51941 11.468C4.29783 11.3358 4.12095 11.1588 3.98877 10.9372C3.8566 10.7155 3.79051 10.4725 3.79051 10.208V9.99801C4.05486 10.0913 4.31532 10.1575 4.5719 10.1963L4.7585 9.05301C4.36975 8.98301 3.93435 8.83523 3.4523 8.60967C3.2035 8.49301 3.00329 8.31606 2.85168 8.07884C2.70006 7.84162 2.62426 7.57912 2.62426 7.29134C2.62426 6.82467 2.73311 6.44162 2.95081 6.14217C3.16851 5.84273 3.49506 5.63856 3.93046 5.52967L4.37363 5.41301V3.49967C4.37363 3.28967 4.42611 3.09523 4.53108 2.91634C4.63604 2.73745 4.77793 2.59551 4.95676 2.49051C5.13558 2.38551 5.32996 2.33301 5.53988 2.33301ZM7.28926 1.95967C7.07156 1.71079 6.8111 1.51634 6.50787 1.37634C6.20465 1.23634 5.88198 1.16634 5.53988 1.16634C5.12003 1.16634 4.73128 1.27134 4.37363 1.48134C4.01598 1.69134 3.7322 1.97523 3.52227 2.33301C3.31235 2.69079 3.20738 3.07967 3.20738 3.49967V4.53801C2.70201 4.74023 2.3016 5.04356 2.00615 5.44801C1.64072 5.95356 1.45801 6.56801 1.45801 7.29134C1.45801 7.74245 1.56297 8.15856 1.7729 8.53967C1.98282 8.92079 2.26661 9.2319 2.62426 9.47301V10.208C2.62426 10.6825 2.74283 11.12 2.97996 11.5205C3.2171 11.9211 3.53588 12.24 3.93629 12.4772C4.3367 12.7144 4.77405 12.833 5.24832 12.833C5.65262 12.833 6.03165 12.7455 6.38541 12.5705C6.73918 12.3955 7.04046 12.1563 7.28926 11.853C7.53806 12.1563 7.83934 12.3955 8.1931 12.5705C8.54686 12.7455 8.9259 12.833 9.3302 12.833C9.80447 12.833 10.2418 12.7144 10.6422 12.4772C11.0426 12.24 11.3614 11.9211 11.5986 11.5205C11.8357 11.12 11.9543 10.6825 11.9543 10.208V9.47301C12.3119 9.2319 12.5957 8.92079 12.8056 8.53967C13.0155 8.15856 13.1205 7.74245 13.1205 7.29134C13.1205 6.56801 12.9378 5.95356 12.5724 5.44801C12.2769 5.04356 11.8765 4.74023 11.3711 4.53801V3.49967C11.3711 3.07967 11.2662 2.69079 11.0562 2.33301C10.8463 1.97523 10.5625 1.69134 10.2049 1.48134C9.84723 1.27134 9.45848 1.16634 9.03863 1.16634C8.69653 1.16634 8.37387 1.23634 8.07065 1.37634C7.76742 1.51634 7.50696 1.71079 7.28926 1.95967ZM10.788 9.99801V10.208C10.788 10.4725 10.7219 10.7155 10.5897 10.9372C10.4576 11.1588 10.2807 11.3358 10.0591 11.468C9.83751 11.6002 9.59455 11.6663 9.3302 11.6663C9.06585 11.6663 8.82288 11.6002 8.60129 11.468C8.3797 11.3358 8.20282 11.1588 8.07065 10.9372C7.93847 10.7155 7.87238 10.4725 7.87238 10.208C7.87238 9.50023 8.03955 8.96551 8.37387 8.60384C8.7082 8.24217 9.25245 7.99523 10.0066 7.86301L9.82002 6.71967C9.01142 6.8519 8.36221 7.10467 7.87238 7.47801V3.49967C7.87238 3.28967 7.92486 3.09523 8.02983 2.91634C8.13479 2.73745 8.27668 2.59551 8.45551 2.49051C8.63433 2.38551 8.82871 2.33301 9.03863 2.33301C9.24856 2.33301 9.44293 2.38551 9.62176 2.49051C9.80058 2.59551 9.94248 2.73745 10.0474 2.91634C10.1524 3.09523 10.2049 3.28967 10.2049 3.49967V5.41301L10.6481 5.52967C11.0835 5.63856 11.41 5.84273 11.6277 6.14217C11.8454 6.44162 11.9543 6.82467 11.9543 7.29134C11.9543 7.57912 11.8785 7.84162 11.7268 8.07884C11.5752 8.31606 11.375 8.49301 11.1262 8.60967C10.6442 8.83523 10.2088 8.98301 9.82002 9.05301L10.0066 10.1963C10.2632 10.1575 10.5237 10.0913 10.788 9.99801Z"
                          fill="#EF4444"
                        />
                      </svg>
                    </span>
                    <h4>The Cortisol - Hair Loss Connection</h4>
                  </div>
                  <span className="stress-level-badge">
                    Your Stress Level: Minimal
                  </span>
                </div>

                <div className="stress-img-info-warpper">
                  <p>
                    Chronic stress triggers cortisol overproduction, pushing
                    hair follicles prematurely into the telogen (resting) phase.
                    This causes <strong>diffuse shedding 2-3 months</strong>{" "}
                    after the stress event. Lowering cortisol is a core pillar
                    of your recovery plan.
                  </p>
                  <div
                    className="stress-cortisol-image"
                    style={{ backgroundImage: `url(${stressProtocolImage})` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </article>

            <p className="stress-techniques-title">
              Evidence-Based Cortisol Reduction Techniques
            </p>

            <div className="stress-techniques-list">
              {stressReductionTechniques.map((item, index) => (
                <article
                  className={`stress-technique-card${!fullReport && index >= 2 ? " locked-card" : ""}`}
                  key={item.title}
                >
                  {/* Locked insight badge for last 3 items when not fullReport */}
                  {!fullReport && index >= 2 && (
                    <div className="locked-insight">
                      <div className="locked-insight-badge">

                        <span>Locked Insight</span>
                      </div>
                      <svg
                        width="13"
                        height="12"
                        viewBox="0 0 13 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M9.75 5H10.25C10.39 5 10.5083 5.04833 10.605 5.145C10.7017 5.24167 10.75 5.36 10.75 5.5V10.5C10.75 10.64 10.7017 10.7583 10.605 10.855C10.5083 10.9517 10.39 11 10.25 11H2.25C2.11 11 1.99167 10.9517 1.895 10.855C1.79833 10.7583 1.75 10.64 1.75 10.5V5.5C1.75 5.36 1.79833 5.24167 1.895 5.145C1.99167 5.04833 2.11 5 2.25 5H2.75V4.5C2.75 3.86667 2.91 3.27667 3.23 2.73C3.53667 2.20333 3.95333 1.78667 4.48 1.48C5.02667 1.16 5.61667 1 6.25 1C6.88333 1 7.47333 1.16 8.02 1.48C8.54667 1.78667 8.96333 2.20333 9.27 2.73C9.59 3.27667 9.75 3.86667 9.75 4.5V5ZM8.75 5V4.5C8.75 4.04667 8.63833 3.62833 8.415 3.245C8.19167 2.86167 7.88833 2.55833 7.505 2.335C7.12167 2.11167 6.70333 2 6.25 2C5.79667 2 5.37833 2.11167 4.995 2.335C4.61167 2.55833 4.30833 2.86167 4.085 3.245C3.86167 3.62833 3.75 4.04667 3.75 4.5V5H8.75ZM5.75 7V9H6.75V7H5.75Z"
                          fill="#F4C430"
                        />
                      </svg>
                    </div>
                  )}
                  <div>
                    <div className="stress-technique-head">
                      <span
                        className={`stress-technique-icon stress-technique-icon-${item.tone}`}
                        aria-hidden="true"
                      >
                        {item.icon === "breathing" && (
                          <svg
                            width="13"
                            height="12"
                            viewBox="0 0 13 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M11.25 8.75C11.25 9.33667 11.24 9.72333 11.22 9.91C11.1867 10.19 11.1133 10.3867 11 10.5C10.8867 10.6133 10.69 10.6867 10.41 10.72C10.2233 10.74 9.83667 10.75 9.25 10.75C8.33667 10.75 7.67 10.4367 7.25 9.81C6.91667 9.31 6.75 8.62333 6.75 7.75L6.74 6.97L7.75 7.56V7.75C7.75 8.45 7.865 8.95833 8.095 9.275C8.325 9.59167 8.71 9.75 9.25 9.75C9.76333 9.75 10.09 9.74333 10.23 9.73C10.2433 9.59 10.25 9.26333 10.25 8.75C10.25 7.96333 10.1667 7.22 10 6.52C9.84 5.84667 9.61667 5.27333 9.33 4.8C9.13667 4.47333 8.94333 4.23667 8.75 4.09C8.57667 3.95667 8.43333 3.91 8.32 3.95C8.24 3.97667 8.16333 4.05833 8.09 4.195C8.01667 4.33167 7.95333 4.52 7.9 4.76L7.01 4.24C7.21667 3.56667 7.54667 3.15333 8 3C8.37333 2.87333 8.75333 2.925 9.14 3.155C9.52667 3.385 9.87667 3.76 10.19 4.28C10.5167 4.82 10.77 5.46 10.95 6.2C11.15 6.99333 11.25 7.84333 11.25 8.75ZM4.5 3C4.95333 3.15333 5.28333 3.56667 5.49 4.24L4.6 4.76C4.54667 4.52 4.48333 4.33167 4.41 4.195C4.33667 4.05833 4.26 3.97667 4.18 3.95C4.06667 3.91 3.92333 3.95667 3.75 4.09C3.55667 4.23667 3.36333 4.47333 3.17 4.8C2.88333 5.27333 2.66 5.84667 2.5 6.52C2.33333 7.22 2.25 7.96333 2.25 8.75C2.25 9.26333 2.25667 9.59 2.27 9.73C2.41 9.74333 2.73667 9.75 3.25 9.75C3.79 9.75 4.175 9.59167 4.405 9.275C4.635 8.95833 4.75 8.45 4.75 7.75V7.56L5.76 6.98L5.75 7.75C5.75 8.62333 5.58333 9.31 5.25 9.81C4.83 10.4367 4.16333 10.75 3.25 10.75C2.66333 10.75 2.27667 10.74 2.09 10.72C1.81 10.6867 1.61333 10.6133 1.5 10.5C1.38667 10.3867 1.31333 10.19 1.28 9.91C1.26 9.71667 1.25 9.33 1.25 8.75C1.25 7.84333 1.35 6.99333 1.55 6.2C1.73 5.46 1.98333 4.82 2.31 4.28C2.63 3.76 2.98167 3.385 3.365 3.155C3.74833 2.925 4.12667 2.87333 4.5 3ZM6.75 1.25V4.96L9.1 6.32L8.6 7.18L6.25 5.83L3.9 7.18L3.4 6.32L5.75 4.96V1.25H6.75Z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                        {item.icon === "massage" && (
                          <svg
                            width="13"
                            height="12"
                            viewBox="0 0 13 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M2.62012 4.54004C2.76012 4.54004 2.87845 4.58837 2.97512 4.68504C3.07178 4.78171 3.12012 4.90004 3.12012 5.04004C3.52012 5.04004 3.90512 5.10504 4.27512 5.23504C4.64512 5.36504 4.98345 5.55004 5.29012 5.79004H6.37012C6.69678 5.79004 7.00512 5.85671 7.29512 5.99004C7.58512 6.12337 7.83678 6.30671 8.05012 6.54004H9.62012C10.1135 6.54004 10.5618 6.67004 10.9651 6.93004C11.3685 7.19004 11.6735 7.53337 11.8801 7.96004C11.2801 8.76004 10.5268 9.38671 9.62012 9.84004C8.68012 10.3067 7.68012 10.54 6.62012 10.54C5.26678 10.54 4.09012 10.2634 3.09012 9.71004C3.05678 9.81004 2.99678 9.89004 2.91012 9.95004C2.82345 10.01 2.72678 10.04 2.62012 10.04H1.12012C0.980117 10.04 0.861784 9.99171 0.765117 9.89504C0.668451 9.79837 0.620117 9.68004 0.620117 9.54004V5.04004C0.620117 4.90004 0.668451 4.78171 0.765117 4.68504C0.861784 4.58837 0.980117 4.54004 1.12012 4.54004H2.62012ZM3.12012 6.04004V8.55004L3.14012 8.57004C4.06678 9.21671 5.22678 9.54004 6.62012 9.54004C7.36678 9.54004 8.07845 9.40337 8.75512 9.13004C9.43178 8.85671 10.0268 8.47004 10.5401 7.97004L10.6001 7.91004L10.5501 7.86004C10.3035 7.66671 10.0268 7.56004 9.72012 7.54004H9.62012H8.57012C8.60345 7.70004 8.62012 7.86671 8.62012 8.04004V8.54004H4.12012V7.54004H7.52012L7.50012 7.50004C7.40012 7.30004 7.25845 7.13504 7.07512 7.00504C6.89178 6.87504 6.68345 6.80337 6.45012 6.79004H4.91012C4.67678 6.55671 4.40678 6.37337 4.10012 6.24004C3.79345 6.10671 3.46678 6.04004 3.12012 6.04004ZM2.12012 5.54004H1.62012V9.04004H2.12012V5.54004ZM6.94012 1.83004L7.12012 2.00004L7.30012 1.83004C7.46012 1.67004 7.64678 1.5617 7.86012 1.50504C8.07345 1.44837 8.28845 1.44837 8.50512 1.50504C8.72178 1.5617 8.91012 1.67004 9.07012 1.83004C9.23012 1.99004 9.33678 2.17671 9.39012 2.39004C9.44345 2.60337 9.44345 2.81671 9.39012 3.03004C9.33678 3.24337 9.23012 3.43004 9.07012 3.59004L7.12012 5.54004L5.18012 3.59004C5.02012 3.43004 4.91178 3.24337 4.85512 3.03004C4.79845 2.81671 4.79845 2.60337 4.85512 2.39004C4.91178 2.17671 5.02012 1.99004 5.18012 1.83004C5.34012 1.67004 5.52678 1.5617 5.74012 1.50504C5.95345 1.44837 6.16678 1.44837 6.38012 1.50504C6.59345 1.5617 6.78012 1.67004 6.94012 1.83004ZM5.88012 2.53004C5.84012 2.5767 5.81678 2.63004 5.81012 2.69004C5.80345 2.75004 5.81678 2.80337 5.85012 2.85004L5.88012 2.89004L7.12012 4.12004L8.36012 2.89004C8.40012 2.84337 8.42345 2.79004 8.43012 2.73004C8.43678 2.67004 8.42345 2.6167 8.39012 2.57004L8.36012 2.53004C8.31345 2.49004 8.26012 2.46671 8.20012 2.46004C8.14012 2.45337 8.08678 2.47004 8.04012 2.51004L8.00012 2.53004L7.12012 3.42004L6.24012 2.53004L6.20012 2.51004C6.15345 2.47004 6.10012 2.45337 6.04012 2.46004C5.98012 2.46671 5.92678 2.49004 5.88012 2.53004Z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                        {item.icon === "mindfulness" && (
                          <svg
                            width="13"
                            height="12"
                            viewBox="0 0 13 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M6.75 0.5V2.03C7.34333 2.10333 7.89167 2.3 8.395 2.62C8.89833 2.94 9.31 3.35167 9.63 3.855C9.95 4.35833 10.1467 4.90667 10.22 5.5H11.75V6.5H10.22C10.1467 7.09333 9.95 7.64167 9.63 8.145C9.31 8.64833 8.89833 9.06 8.395 9.38C7.89167 9.7 7.34333 9.89667 6.75 9.97V11.5H5.75V9.97C5.15667 9.89667 4.60833 9.7 4.105 9.38C3.60167 9.06 3.19 8.64833 2.87 8.145C2.55 7.64167 2.35333 7.09333 2.28 6.5H0.75V5.5H2.28C2.35333 4.90667 2.55 4.35833 2.87 3.855C3.19 3.35167 3.60167 2.94 4.105 2.62C4.60833 2.3 5.15667 2.10333 5.75 2.03V0.5H6.75ZM6.25 3C5.71 3 5.20667 3.13667 4.74 3.41C4.28667 3.67667 3.92667 4.03667 3.66 4.49C3.38667 4.95667 3.25 5.46 3.25 6C3.25 6.54 3.38667 7.04333 3.66 7.51C3.92667 7.96333 4.28667 8.32333 4.74 8.59C5.20667 8.86333 5.71 9 6.25 9C6.79 9 7.29333 8.86333 7.76 8.59C8.21333 8.32333 8.57333 7.96333 8.84 7.51C9.11333 7.04333 9.25 6.54 9.25 6C9.25 5.46 9.11333 4.95667 8.84 4.49C8.57333 4.03667 8.21333 3.67667 7.76 3.41C7.29333 3.13667 6.79 3 6.25 3ZM6.25 5C6.43 5 6.59667 5.045 6.75 5.135C6.90333 5.225 7.025 5.34667 7.115 5.5C7.205 5.65333 7.25 5.82 7.25 6C7.25 6.18 7.205 6.34667 7.115 6.5C7.025 6.65333 6.90333 6.775 6.75 6.865C6.59667 6.955 6.43 7 6.25 7C6.07 7 5.90333 6.955 5.75 6.865C5.59667 6.775 5.475 6.65333 5.385 6.5C5.295 6.34667 5.25 6.18 5.25 6C5.25 5.82 5.295 5.65333 5.385 5.5C5.475 5.34667 5.59667 5.225 5.75 5.135C5.90333 5.045 6.07 5 6.25 5Z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                        {item.icon === "progressive" && (
                          <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2.25 8V10H4.25V11H1.25V8H2.25ZM11.25 8V11H8.25V10H10.25V8H11.25ZM4 3.5C4 3.85333 4.075 4.18333 4.225 4.49C4.375 4.79667 4.58333 5.055 4.85 5.265C5.11667 5.475 5.41667 5.61667 5.75 5.69V8.5H6.75V5.69C7.08333 5.61667 7.38333 5.475 7.65 5.265C7.91667 5.055 8.125 4.79667 8.275 4.49C8.425 4.18333 8.5 3.85333 8.5 3.5H9.5C9.5 4.12 9.34 4.69 9.02 5.21C8.7 5.71667 8.27667 6.10667 7.75 6.38V9.5H4.75V6.38C4.22333 6.10667 3.80333 5.71667 3.49 5.21C3.16333 4.69 3 4.12 3 3.5H4ZM6.25 2.5C6.47667 2.5 6.685 2.55667 6.875 2.67C7.065 2.78333 7.21667 2.935 7.33 3.125C7.44333 3.315 7.5 3.52333 7.5 3.75C7.5 3.97667 7.44333 4.185 7.33 4.375C7.21667 4.565 7.065 4.71667 6.875 4.83C6.685 4.94333 6.47667 5 6.25 5C6.02333 5 5.815 4.94333 5.625 4.83C5.435 4.71667 5.28333 4.565 5.17 4.375C5.05667 4.185 5 3.97667 5 3.75C5 3.52333 5.05667 3.315 5.17 3.125C5.28333 2.935 5.435 2.78333 5.625 2.67C5.815 2.55667 6.02333 2.5 6.25 2.5ZM4.25 1V2H2.25V4H1.25V1H4.25ZM11.25 1V4H10.25V2H8.25V1H11.25Z" fill="#9FB4D0" />
                          </svg>

                        )}
                        {item.icon === "adaptogen" && (
                          <svg
                            width="13"
                            height="12"
                            viewBox="0 0 13 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M10.75 1.25V2.25C10.75 3.79667 10.4767 5.11333 9.93 6.2C9.42333 7.21333 8.70667 7.98 7.78 8.5C6.9 9 5.89 9.25 4.75 9.25H2.87C2.79 9.70333 2.75 10.2033 2.75 10.75H1.75C1.75 10.07 1.80667 9.44667 1.92 8.88C1.80667 8.23333 1.75 7.35667 1.75 6.25C1.75 5.57 1.88 4.92 2.14 4.3C2.39333 3.70667 2.75167 3.17833 3.215 2.715C3.67833 2.25167 4.20667 1.89333 4.8 1.64C5.42 1.38 6.07 1.25 6.75 1.25C6.95 1.25 7.26333 1.28333 7.69 1.35C8.03667 1.40333 8.31 1.43667 8.51 1.45C8.85 1.47667 9.18333 1.48 9.51 1.46C9.90333 1.42667 10.3167 1.35667 10.75 1.25ZM6.75 2.25C6.02333 2.25 5.35 2.43333 4.73 2.8C4.13 3.15333 3.65333 3.63 3.3 4.23C2.93333 4.85 2.75 5.52333 2.75 6.25V6.77C3.05667 6.29 3.44333 5.84333 3.91 5.43C4.35667 5.03667 4.88667 4.66667 5.5 4.32L6 5.18C5.26 5.60667 4.66333 6.05667 4.21 6.53C3.73 7.03 3.37333 7.60333 3.14 8.25H4.75C5.75667 8.25 6.63167 8.03 7.375 7.59C8.11833 7.15 8.69 6.50333 9.09 5.65C9.51 4.76333 9.73 3.69333 9.75 2.44C9.41667 2.47333 9.07667 2.48333 8.73 2.47C8.41667 2.45 8.05333 2.41 7.64 2.35C7.34667 2.30333 7.15 2.275 7.05 2.265C6.95 2.255 6.85 2.25 6.75 2.25Z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                      </span>
                      <h4>{item.title}</h4>
                    </div>
                  </div>
                  {/* Show content only when fullReport OR first 2 items */}
                  {(fullReport || index < 2) ? (
                    <>
                      <p className="stress-technique-desc">{item.desc}</p>
                      <p
                        className={`stress-technique-impact stress-technique-impact-${item.tone}`}
                      >
                        <span aria-hidden="true">★</span>
                        {item.impact}
                      </p>
                      <br></br>
                      <p className="stress-technique-how">
                        <span aria-hidden="true">›</span>
                        <strong>How:</strong>
                        <em>{item.how}</em>
                      </p>
                    </>
                  ) : (
                    /* Unlock overlay for locked cards - replaces content */
                    <div className="locked-stress-container">
                      <div>
                        <p className="stress-technique-desc">{item.desc}</p>
                        <p
                          className={`stress-technique-impact stress-technique-impact-${item.tone}`}
                        >
                          <span aria-hidden="true">★</span>
                          {item.impact}
                        </p>
                        <br></br>
                        <p className="stress-technique-how">
                          <span aria-hidden="true">›</span>
                          <strong>How:</strong>
                          <em>{item.how}</em>
                        </p>
                      </div>

                      <div className="stress-locked-container">


                        <div className="stress-locked-content">
                          <p className="unlock-title">
                            Unlock Advanced Stress Recovery Protocol
                          </p>
                          <p className="unlock-description">
                            Get personalized, clinically-backed techniques
                            tailored to your hair loss profile.
                          </p>
                          <button className="unlock-cta-btn">
                            Unlock Full Plan
                          </button>
                        </div>
                      </div>
                    </div>

                  )}
                </article>
              ))}
            </div>

            <p className="stress-foods-title">Cortisol-Reducing Foods</p>

            <div className="stress-foods-grid">
              {cortisolReducingFoods.map((food) => (
                <article className="stress-food-card" key={food.title}>
                  <div className="stress-food-head">
                    <span className="stress-food-icon" aria-hidden="true">
                      <svg
                        width="13"
                        height="12"
                        viewBox="0 0 13 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M10.75 1.25V2.25C10.75 3.79667 10.4767 5.11333 9.93 6.2C9.42333 7.21333 8.70667 7.98 7.78 8.5C6.9 9 5.89 9.25 4.75 9.25H2.87C2.79 9.70333 2.75 10.2033 2.75 10.75H1.75C1.75 10.07 1.80667 9.44667 1.92 8.88C1.80667 8.23333 1.75 7.35667 1.75 6.25C1.75 5.57 1.88 4.92 2.14 4.3C2.39333 3.70667 2.75167 3.17833 3.215 2.715C3.67833 2.25167 4.20667 1.89333 4.8 1.64C5.42 1.38 6.07 1.25 6.75 1.25C6.95 1.25 7.26333 1.28333 7.69 1.35C8.03667 1.40333 8.31 1.43667 8.51 1.45C8.85 1.47667 9.18333 1.48 9.51 1.46C9.90333 1.42667 10.3167 1.35667 10.75 1.25ZM6.75 2.25C6.02333 2.25 5.35 2.43333 4.73 2.8C4.13 3.15333 3.65333 3.63 3.3 4.23C2.93333 4.85 2.75 5.52333 2.75 6.25V6.77C3.05667 6.29 3.44333 5.84333 3.91 5.43C4.35667 5.03667 4.88667 4.66667 5.5 4.32L6 5.18C5.26 5.60667 4.66333 6.05667 4.21 6.53C3.73 7.03 3.37333 7.60333 3.14 8.25H4.75C5.75667 8.25 6.63167 8.03 7.375 7.59C8.11833 7.15 8.69 6.50333 9.09 5.65C9.51 4.76333 9.73 3.69333 9.75 2.44C9.41667 2.47333 9.07667 2.48333 8.73 2.47C8.41667 2.45 8.05333 2.41 7.64 2.35C7.34667 2.30333 7.15 2.275 7.05 2.265C6.95 2.255 6.85 2.25 6.75 2.25Z"
                          fill="#10B981"
                        />
                      </svg>
                    </span>
                    <h4>{food.title}</h4>
                  </div>
                  <p>{food.desc}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Section: Predictive Model */}
          <section
            className="predictive-model-section"
            aria-label="Predictive Model"
          >
            <header className="predictive-model-header">
              <div className="predictive-model-title-icon" aria-hidden="true">
                <svg
                  width="19"
                  height="18"
                  viewBox="0 0 19 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3.85498 2.25V14.25H15.855V15.75H2.35498V2.25H3.85498ZM15.33 4.725L16.395 5.775L12.105 10.065L9.85498 7.815L6.64498 11.025L5.57998 9.975L9.85498 5.685L12.105 7.935L15.33 4.725Z"
                    fill="#00E5FF"
                  />
                </svg>
              </div>
              <div className="predictive-model-head-copy">
                <span className="predictive-model-kicker">
                  Predictive Model
                </span>
                <h3>Hair Loss Risk Predictor</h3>
                <p>5-year risk trajectory - untreated vs with treatment</p>
              </div>
            </header>

            <article className="predictive-model-chart-card">
              <div className="predictive-model-chart-head">
                <h4>Risk Progression Chart</h4>
                <div
                  className="predictive-model-legend"
                  aria-label="Chart legend"
                >
                  <span>
                    <i
                      className="legend-dot legend-dot-red"
                      aria-hidden="true"
                    />
                    Untreated
                  </span>
                  <span>
                    <i
                      className="legend-dot legend-dot-green"
                      aria-hidden="true"
                    />
                    With Treatment
                  </span>
                </div>
              </div>

              <p className="predictive-model-scale">0-100 Risk Scale</p>

              <div className="predictive-risk-rows">
                {predictiveRiskRows.map((row) => (
                  <div className="predictive-risk-row" key={row.label}>
                    <p className="predictive-risk-label">{row.label}</p>
                    <div className="predictive-risk-bars">
                      <div className="predictive-risk-track">
                        <span
                          className="predictive-risk-fill predictive-risk-fill-red"
                          style={{ width: `${row.untreated}%` }}
                        />
                      </div>
                      <div className="predictive-risk-track">
                        <span
                          className="predictive-risk-fill predictive-risk-fill-green"
                          style={{ width: `${row.treated}%` }}
                        />
                      </div>
                    </div>
                    <div
                      className="predictive-risk-values"
                      aria-label={`${row.label} values`}
                    >
                      <strong className="predictive-risk-value-red">
                        Untreated: {row.untreated}
                      </strong>
                      <strong className="predictive-risk-value-green">
                        Treated: {row.treated}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <div className="predictive-summary-grid">
              <article className="predictive-summary-card predictive-summary-card-red">
                <p>Peak Risk (Untreated)</p>
                <h5>
                  {predictiveRiskRows.length > 0
                    ? Math.max(...predictiveRiskRows.map((r) => r.untreated || 0))
                    : 85}
                  <span>/100</span>
                </h5>
                <em>Severe Progression</em>
              </article>

              <article className="predictive-summary-card predictive-summary-card-green">
                <p>Stabilized Risk (Treated)</p>
                <h5>
                  {safeArray(predictiveRiskRows).some((r) => r.treated > 0)
                    ? Math.min(
                      ...safeArray(predictiveRiskRows)
                        .filter((r) => r.treated > 0)
                        .map((r) => r.treated)
                    )
                    : 15}
                  <span>/100</span>
                </h5>
                <em>Long-term Stable</em>
              </article>
            </div>

            <article className="predictive-factors-card">
              <h4>Active Risk Factors Identified</h4>

              <div className="predictive-factor-list">
                {activeRiskFactors.map((factor) => (
                  <div className="predictive-factor-item" key={factor.label}>
                    <div className="predictive-factor-row">
                      <div className="predictive-factor-left">
                        <i
                          className={`predictive-factor-dot predictive-factor-dot-${factor.tone}`}
                          aria-hidden="true"
                        />
                        <span>{factor.label}</span>
                      </div>
                      <strong
                        className={`predictive-factor-level predictive-factor-level-${factor.tone}`}
                      >
                        {factor.level || "Active"}
                      </strong>
                    </div>
                    <p className="predictive-factor-subnote">{factor.note}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="predictive-outlook-card">
              <div className="predictive-outlook-icon" aria-hidden="true">
                <svg
                  width="13"
                  height="12"
                  viewBox="0 0 13 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4.75 1V2H7.75V1H8.75V2H10.75C10.89 2 11.0083 2.04833 11.105 2.145C11.2017 2.24167 11.25 2.36 11.25 2.5V10.5C11.25 10.64 11.2017 10.7583 11.105 10.855C11.0083 10.9517 10.89 11 10.75 11H1.75C1.61 11 1.49167 10.9517 1.395 10.855C1.29833 10.7583 1.25 10.64 1.25 10.5V2.5C1.25 2.36 1.29833 2.24167 1.395 2.145C1.49167 2.04833 1.61 2 1.75 2H3.75V1H4.75ZM10.25 5.5H2.25V10H10.25V5.5ZM7.77 6.07L8.47 6.78L6 9.25L4.23 7.48L4.94 6.78L6 7.84L7.77 6.07ZM3.75 3H2.25V4.5H10.25V3H8.75V3.5H7.75V3H4.75V3.5H3.75V3Z"
                    fill="#10B981"
                  />
                </svg>
              </div>
              <div className="predictive-outlook-copy">
                <h4>5-Year Outlook</h4>
                <p>
                  {asDisplayText(lockedNarrative?.riskProjections?.summary, "Positive with early intervention. Projected risk reduction of healthy results with consistent treatment adherence.")}
                </p>
              </div>
            </article>
          </section>

          {/* Section: Hair Shaft & Scalp Condition Insights */}
          <section
            className="shaft-scalp-insights-section"
            aria-label="Hair Shaft and Scalp Condition Insights"
          >
            <header className="shaft-scalp-insights-header">
              <span
                className="shaft-scalp-insights-header-icon"
                aria-hidden="true"
              >
                <svg
                  width="19"
                  height="18"
                  viewBox="0 0 19 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10.275 1.97953L12.705 6.19453C12.815 6.37453 12.8425 6.56453 12.7875 6.76453C12.7325 6.96453 12.615 7.11453 12.435 7.21453L11.46 7.78453L12.21 9.08953L10.905 9.83953L10.155 8.53453L9.195 9.08953C9.015 9.19953 8.825 9.22703 8.625 9.17203C8.425 9.11703 8.27 8.99953 8.16 8.81953L6.78 6.43453C6.27 6.59453 5.815 6.84953 5.415 7.19953C5.015 7.54953 4.7 7.96953 4.47 8.45953C4.24 8.94953 4.125 9.46953 4.125 10.0195C4.125 10.4795 4.205 10.9245 4.365 11.3545C4.975 10.9645 5.645 10.7695 6.375 10.7695C6.995 10.7695 7.5725 10.912 8.1075 11.197C8.6425 11.482 9.085 11.8695 9.435 12.3595L15.195 9.02953L15.945 10.3195L10.035 13.7395C10.095 13.9995 10.125 14.2595 10.125 14.5195C10.125 14.7795 10.1 15.0295 10.05 15.2695H16.125V16.7695H3.375C3.135 16.4495 2.95 16.0995 2.82 15.7195C2.69 15.3395 2.625 14.9395 2.625 14.5195C2.625 13.7795 2.83 13.0995 3.24 12.4795C2.83 11.7095 2.625 10.8895 2.625 10.0195C2.625 9.28953 2.77 8.58953 3.06 7.91953C3.35 7.26953 3.75 6.70203 4.26 6.21703C4.77 5.73203 5.355 5.36453 6.015 5.11453L5.73 4.60453C5.59 4.36453 5.52 4.11203 5.52 3.84703C5.52 3.58203 5.5875 3.33453 5.7225 3.10453C5.8575 2.87453 6.04 2.68953 6.27 2.54953L8.22 1.42453C8.46 1.28453 8.7125 1.21703 8.9775 1.22203C9.2425 1.22703 9.49 1.29453 9.72 1.42453C9.95 1.55453 10.135 1.73953 10.275 1.97953ZM6.375 12.2695C5.965 12.2695 5.5875 12.372 5.2425 12.577C4.8975 12.782 4.625 13.057 4.425 13.402C4.225 13.747 4.125 14.1195 4.125 14.5195C4.125 14.7795 4.17 15.0295 4.26 15.2695H8.49C8.58 15.0295 8.625 14.7795 8.625 14.5195C8.625 14.1195 8.525 13.747 8.325 13.402C8.125 13.057 7.8525 12.782 7.5075 12.577C7.1625 12.372 6.785 12.2695 6.375 12.2695ZM8.97 2.72953L7.02 3.85453L9.09 7.42453L11.04 6.29953L8.97 2.72953Z"
                    fill="#00E5FF"
                  />
                </svg>
              </span>
              <div className="shaft-scalp-insights-head-copy">
                <h3>Hair Shaft &amp; Scalp Condition Insights</h3>
                <p>
                  Structural analysis of shaft integrity and scalp condition
                </p>
              </div>
            </header>

            <div className="shaft-scalp-insights-card-list">
              {shaftScalpInsightCards.map((item, cardIndex) => {
                const isLocked = !fullReport && cardIndex >= shaftScalpInsightCards.length - 3;

                return (
                  <article
                    className={`shaft-scalp-insights-card${item.showImage ? " shaft-scalp-insights-card-has-image" : ""}${isLocked ? " locked-card" : ""}`}
                    key={item.title}
                  >
                    {/* {isLocked && (
                    <div className="locked-insight">
                      <div className="locked-insight-badge">
                        <span>Locked Insight</span>
                      </div>
                      <div className="locked-insight-icon" aria-hidden="true">
                        <svg
                          width="13"
                          height="12"
                          viewBox="0 0 13 12"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M9.75 5H10.25C10.39 5 10.5083 5.04833 10.605 5.145C10.7017 5.24167 10.75 5.36 10.75 5.5V10.5C10.75 10.64 10.7017 10.7583 10.605 10.855C10.5083 10.9517 10.39 11 10.25 11H2.25C2.11 11 1.99167 10.9517 1.895 10.855C1.79833 10.7583 1.75 10.64 1.75 10.5V5.5C1.75 5.36 1.79833 5.24167 1.895 5.145C1.99167 5.04833 2.11 5 2.25 5H2.75V4.5C2.75 3.86667 2.91 3.27667 3.23 2.73C3.53667 2.20333 3.95333 1.78667 4.48 1.48C5.02667 1.16 5.61667 1 6.25 1C6.88333 1 7.47333 1.16 8.02 1.48C8.54667 1.78667 8.96333 2.20333 9.27 2.73C9.59 3.27667 9.75 3.86667 9.75 4.5V5ZM8.75 5V4.5C8.75 4.04667 8.63833 3.62833 8.415 3.245C8.19167 2.86167 7.88833 2.55833 7.505 2.335C7.12167 2.11167 6.70333 2 6.25 2C5.79667 2 5.37833 2.11167 4.995 2.335C4.61167 2.55833 4.30833 2.86167 4.085 3.245C3.86167 3.62833 3.75 4.04667 3.75 4.5V5H8.75ZM5.75 7V9H6.75V7H5.75Z"
                            fill="#00E5FF"
                          />
                        </svg>
                      </div>
                    </div>
                  )} */}
                    <div className="shaft-scalp-insights-card-head">
                      <div className="shaft-scalp-insights-title-wrap">
                        <span
                          className={`shaft-scalp-insights-item-icon shaft-scalp-insights-item-icon-${item.tone}`}
                          aria-hidden="true"
                        >
                          {item.icon === "breakage" && (
                            <svg
                              width="15"
                              height="14"
                              viewBox="0 0 15 14"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M6.12301 3.49967C6.12301 3.91967 6.01805 4.30856 5.80812 4.66634L7.28926 6.17134L11.2079 2.25134C11.3634 2.10356 11.5402 2.00245 11.7385 1.94801C11.9368 1.89356 12.137 1.89356 12.3391 1.94801C12.5413 2.00245 12.7162 2.10356 12.8639 2.25134L5.79646 9.30967C6.01416 9.67523 6.12301 10.07 6.12301 10.4938C6.12301 10.9177 6.01805 11.3086 5.80812 11.6663C5.5982 12.0241 5.31441 12.308 4.95676 12.518C4.59911 12.728 4.21036 12.833 3.79051 12.833C3.37066 12.833 2.98191 12.728 2.62426 12.518C2.26661 12.308 1.98282 12.0241 1.7729 11.6663C1.56297 11.3086 1.45801 10.9197 1.45801 10.4997C1.45801 10.0797 1.56297 9.69079 1.7729 9.33301C1.98282 8.97523 2.26661 8.69134 2.62426 8.48134C2.98191 8.27134 3.3726 8.16634 3.79634 8.16634C4.22008 8.16634 4.61466 8.27523 4.98008 8.49301L6.46122 6.99967L4.98008 5.50634C4.61466 5.72412 4.22008 5.83301 3.79634 5.83301C3.3726 5.83301 2.98191 5.72801 2.62426 5.51801C2.26661 5.30801 1.98282 5.02412 1.7729 4.66634C1.56297 4.30856 1.45801 3.91967 1.45801 3.49967C1.45801 3.07967 1.56297 2.69079 1.7729 2.33301C1.98282 1.97523 2.26661 1.69134 2.62426 1.48134C2.98191 1.27134 3.37066 1.16634 3.79051 1.16634C4.21036 1.16634 4.59911 1.27134 4.95676 1.48134C5.31441 1.69134 5.5982 1.97523 5.80812 2.33301C6.01805 2.69079 6.12301 3.07967 6.12301 3.49967ZM4.95676 3.49967C4.95676 3.28967 4.90428 3.09523 4.79931 2.91634C4.69435 2.73745 4.55246 2.59551 4.37363 2.49051C4.19481 2.38551 4.00043 2.33301 3.79051 2.33301C3.58058 2.33301 3.38621 2.38551 3.20738 2.49051C3.02856 2.59551 2.88666 2.73745 2.7817 2.91634C2.67674 3.09523 2.62426 3.28967 2.62426 3.49967C2.62426 3.70967 2.67674 3.90412 2.7817 4.08301C2.88666 4.2619 3.02856 4.40384 3.20738 4.50884C3.38621 4.61384 3.58058 4.66634 3.79051 4.66634C4.00043 4.66634 4.19481 4.61384 4.37363 4.50884C4.55246 4.40384 4.69435 4.2619 4.79931 4.08301C4.90428 3.90412 4.95676 3.70967 4.95676 3.49967ZM12.8639 11.748C12.7162 11.8958 12.5413 11.9969 12.3391 12.0513C12.137 12.1058 11.9368 12.1058 11.7385 12.0513C11.5402 11.9969 11.3634 11.8958 11.2079 11.748L8.1173 8.64467L8.93367 7.82801L12.8639 11.748ZM9.62176 6.41634H10.788V7.58301H9.62176V6.41634ZM11.9543 6.41634H13.1205V7.58301H11.9543V6.41634ZM3.79051 6.41634H4.95676V7.58301H3.79051V6.41634ZM1.45801 6.41634H2.62426V7.58301H1.45801V6.41634ZM3.79051 11.6663C4.00043 11.6663 4.19481 11.6138 4.37363 11.5088C4.55246 11.4038 4.69435 11.2619 4.79931 11.083C4.90428 10.9041 4.95676 10.7097 4.95676 10.4997C4.95676 10.2897 4.90428 10.0952 4.79931 9.91634C4.69435 9.73745 4.55246 9.59551 4.37363 9.49051C4.19481 9.38551 4.00043 9.33301 3.79051 9.33301C3.58058 9.33301 3.38621 9.38551 3.20738 9.49051C3.02856 9.59551 2.88666 9.73745 2.7817 9.91634C2.67674 10.0952 2.62426 10.2897 2.62426 10.4997C2.62426 10.7097 2.67674 10.9041 2.7817 11.083C2.88666 11.2619 3.02856 11.4038 3.20738 11.5088C3.38621 11.6138 3.58058 11.6663 3.79051 11.6663Z"
                                fill={item.tone === "red" ? "#EF4444" : "#F4C430"}
                              />
                            </svg>
                          )}

                          {item.icon === "split" && (
                            <svg
                              width="15"
                              height="14"
                              viewBox="0 0 15 14"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M3.79039 2.91667C3.62712 2.91667 3.48911 2.97306 3.37637 3.08583C3.26363 3.19861 3.20727 3.33667 3.20727 3.5C3.20727 3.66333 3.26363 3.80139 3.37637 3.91417C3.48911 4.02694 3.62712 4.08333 3.79039 4.08333C3.95367 4.08333 4.09167 4.02694 4.20441 3.91417C4.31715 3.80139 4.37352 3.66333 4.37352 3.5C4.37352 3.33667 4.31715 3.19861 4.20441 3.08583C4.09167 2.97306 3.95367 2.91667 3.79039 2.91667ZM2.04102 3.5C2.04102 3.18111 2.11877 2.8875 2.27427 2.61917C2.42977 2.35083 2.64163 2.13889 2.90987 1.98333C3.17811 1.82778 3.47162 1.75 3.79039 1.75C4.10917 1.75 4.40267 1.82778 4.67091 1.98333C4.93915 2.13889 5.15102 2.35083 5.30652 2.61917C5.46202 2.8875 5.53977 3.18111 5.53977 3.5C5.53977 3.87333 5.43092 4.21167 5.21322 4.515C4.99552 4.81833 4.71562 5.02833 4.37352 5.145V5.25C4.37352 5.46 4.426 5.65444 4.53096 5.83333C4.63592 6.01222 4.77782 6.15417 4.95664 6.25917C5.13547 6.36417 5.32984 6.41667 5.53977 6.41667H9.03852C9.24844 6.41667 9.44282 6.36417 9.62164 6.25917C9.80047 6.15417 9.94236 6.01222 10.0473 5.83333C10.1523 5.65444 10.2048 5.46 10.2048 5.25V5.145C9.86267 5.02833 9.58277 4.81833 9.36507 4.515C9.14737 4.21167 9.03852 3.87333 9.03852 3.5C9.03852 3.18111 9.11627 2.8875 9.27177 2.61917C9.42727 2.35083 9.63913 2.13889 9.90737 1.98333C10.1756 1.82778 10.4691 1.75 10.7879 1.75C11.1067 1.75 11.4002 1.82778 11.6684 1.98333C11.9366 2.13889 12.1485 2.35083 12.304 2.61917C12.4595 2.8875 12.5373 3.18111 12.5373 3.5C12.5373 3.87333 12.4284 4.21167 12.2107 4.515C11.993 4.81833 11.7131 5.02833 11.371 5.145V5.25C11.371 5.67 11.2661 6.05889 11.0561 6.41667C10.8462 6.77444 10.5624 7.05833 10.2048 7.26833C9.84712 7.47833 9.45837 7.58333 9.03852 7.58333H7.87227V8.855C8.21437 8.97167 8.49427 9.18167 8.71197 9.485C8.92967 9.78833 9.03852 10.1267 9.03852 10.5C9.03852 10.8189 8.96077 11.1125 8.80527 11.3808C8.64977 11.6492 8.4379 11.8611 8.16966 12.0167C7.90142 12.1722 7.60792 12.25 7.28914 12.25C6.97037 12.25 6.67686 12.1722 6.40862 12.0167C6.14038 11.8611 5.92852 11.6492 5.77302 11.3808C5.61752 11.1125 5.53977 10.8189 5.53977 10.5C5.53977 10.1267 5.64862 9.78833 5.86632 9.485C6.08402 9.18167 6.36392 8.97167 6.70602 8.855V7.58333H5.53977C5.11992 7.58333 4.73117 7.47833 4.37352 7.26833C4.01587 7.05833 3.73208 6.77444 3.52215 6.41667C3.31223 6.05889 3.20727 5.67 3.20727 5.25V5.145C2.86517 5.02833 2.58527 4.81833 2.36757 4.515C2.14987 4.21167 2.04102 3.87333 2.04102 3.5ZM10.7879 2.91667C10.6246 2.91667 10.4866 2.97306 10.3739 3.08583C10.2611 3.19861 10.2048 3.33667 10.2048 3.5C10.2048 3.66333 10.2611 3.80139 10.3739 3.91417C10.4866 4.02694 10.6246 4.08333 10.7879 4.08333C10.9512 4.08333 11.0892 4.02694 11.2019 3.91417C11.3146 3.80139 11.371 3.66333 11.371 3.5C11.371 3.33667 11.3146 3.19861 11.2019 3.08583C11.0892 2.97306 10.9512 2.91667 10.7879 2.91667ZM7.28914 9.91667C7.12587 9.91667 6.98786 9.97306 6.87512 10.0858C6.76238 10.1986 6.70602 10.3367 6.70602 10.5C6.70602 10.6633 6.76238 10.8014 6.87512 10.9142C6.98786 11.0269 7.12587 11.0833 7.28914 11.0833C7.45242 11.0833 7.59042 11.0269 7.70316 10.9142C7.8159 10.8014 7.87227 10.6633 7.87227 10.5C7.87227 10.3367 7.8159 10.1986 7.70316 10.0858C7.59042 9.97306 7.45242 9.91667 7.28914 9.91667Z"
                                fill={item.tone === "red" ? "#EF4444" : "#F4C430"}
                              />
                            </svg>
                          )}

                          {item.icon === "texture" && (
                            <svg
                              width="15"
                              height="14"
                              viewBox="0 0 15 14"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M11.9541 1.75C12.1174 1.75 12.2554 1.80639 12.3682 1.91917C12.4809 2.03194 12.5373 2.17 12.5373 2.33333V11.6667C12.5373 11.83 12.4809 11.9681 12.3682 12.0808C12.2554 12.1936 12.1174 12.25 11.9541 12.25H2.62414C2.46087 12.25 2.32286 12.1936 2.21012 12.0808C2.09738 11.9681 2.04102 11.83 2.04102 11.6667V2.33333C2.04102 2.17 2.09738 2.03194 2.21012 1.91917C2.32286 1.80639 2.46087 1.75 2.62414 1.75H11.9541ZM6.81098 7.67667L3.20727 8.30667V11.0833H7.41743L6.81098 7.67667ZM11.371 2.91667H7.16085L8.59534 11.0833H11.371V2.91667ZM5.98294 2.91667H3.20727V7.12833L6.61272 6.52167L5.98294 2.91667Z"
                                fill="#EF4444"
                              />
                            </svg>
                          )}

                          {item.icon === "oiliness" && (
                            <svg
                              width="15"
                              height="14"
                              viewBox="0 0 15 14"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <g clipPath="url(#clip0_oiliness_1)">
                                <path
                                  d="M7.28914 2.30999L4.4085 5.20332C3.8798 5.72443 3.52215 6.33888 3.33555 7.04665C3.15673 7.73888 3.15673 8.4311 3.33555 9.12332C3.52215 9.8311 3.87786 10.4475 4.40267 10.9725C4.92748 11.4975 5.54365 11.8533 6.25118 12.04C6.94315 12.2189 7.63513 12.2189 8.3271 12.04C9.03463 11.8533 9.6508 11.4975 10.1756 10.9725C10.7004 10.4475 11.0561 9.8311 11.2427 9.12332C11.4216 8.4311 11.4216 7.73888 11.2427 7.04665C11.0561 6.33888 10.6985 5.72443 10.1698 5.20332L7.28914 2.30999ZM7.28914 0.664987L10.9978 4.37499C11.6742 5.04388 12.1291 5.83721 12.3623 6.75499C12.5956 7.64165 12.5956 8.52832 12.3623 9.41499C12.1291 10.3328 11.6762 11.128 11.0036 11.8008C10.3311 12.4736 9.53612 12.9305 8.61867 13.1717C7.73232 13.3972 6.84597 13.3972 5.95962 13.1717C5.04217 12.9305 4.24717 12.4736 3.57463 11.8008C2.9021 11.128 2.4492 10.3328 2.21595 9.41499C1.9827 8.52832 1.9827 7.64165 2.21595 6.75499C2.4492 5.83721 2.90404 5.04388 3.58047 4.37499L7.28914 0.664987Z"
                                  fill="#F4C430"
                                />
                              </g>
                              <defs>
                                <clipPath id="clip0_oiliness_1">
                                  <rect
                                    width="14.5781"
                                    height="14"
                                    fill="white"
                                  />
                                </clipPath>
                              </defs>
                            </svg>
                          )}
                        </span>
                        <h4>{item.title}</h4>
                      </div>
                      <span
                        className={`shaft-scalp-insights-status shaft-scalp-insights-status-${item.tone}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    {isLocked ? (
                      <div className="locked-shaft-scalp-container">
                        <div>
                          <div className="shaft-scalp-insights-summary-row">
                            <div className="shaft-scalp-insights-summary-main">
                              <p className="shaft-scalp-insights-summary-line">
                                <span
                                  className={`shaft-scalp-insights-summary-icon shaft-scalp-insights-summary-icon-${item.tone}`}
                                  aria-hidden="true"
                                >
                                  <svg
                                    width="13"
                                    height="12"
                                    viewBox="0 0 13 12"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M5.24 8.75H7.26C7.29333 8.46333 7.38667 8.18333 7.54 7.91C7.67333 7.66333 7.87 7.39667 8.13 7.11L8.27 6.96C8.46333 6.76 8.57 6.65 8.59 6.63C8.80333 6.36333 8.96667 6.07 9.08 5.75C9.19333 5.43 9.25 5.09667 9.25 4.75C9.25 4.21 9.11333 3.70667 8.84 3.24C8.57333 2.78667 8.21333 2.42667 7.76 2.16C7.29333 1.88667 6.79 1.75 6.25 1.75C5.71 1.75 5.20667 1.88667 4.74 2.16C4.28667 2.42667 3.92667 2.78667 3.66 3.24C3.38667 3.70667 3.25 4.21 3.25 4.75C3.25 5.09667 3.30667 5.43 3.42 5.75C3.53333 6.07 3.69667 6.36 3.91 6.62C3.93 6.64667 4.03667 6.76 4.23 6.96L4.37 7.11C4.63 7.39667 4.82667 7.66333 4.96 7.91C5.11333 8.18333 5.20667 8.46333 5.24 8.75ZM7.25 9.75H5.25V10.25H7.25V9.75ZM3.13 7.25C2.85 6.90333 2.63333 6.52 2.48 6.1C2.32667 5.66667 2.25 5.21667 2.25 4.75C2.25 4.02333 2.43333 3.35 2.8 2.73C3.15333 2.13 3.63 1.65333 4.23 1.3C4.85 0.933333 5.52333 0.75 6.25 0.75C6.97667 0.75 7.65 0.933333 8.27 1.3C8.87 1.65333 9.34667 2.13 9.7 2.73C10.0667 3.35 10.25 4.02333 10.25 4.75C10.25 5.21667 10.1733 5.66667 10.02 6.1C9.86667 6.52 9.65 6.90333 9.37 7.25C9.32333 7.31 9.23 7.41 9.09 7.55C8.83 7.82333 8.64667 8.04 8.54 8.2C8.34667 8.48 8.25 8.74667 8.25 9V10.25C8.25 10.43 8.205 10.5967 8.115 10.75C8.025 10.9033 7.90333 11.025 7.75 11.115C7.59667 11.205 7.43 11.25 7.25 11.25H5.25C5.07 11.25 4.90333 11.205 4.75 11.115C4.59667 11.025 4.475 10.9033 4.385 10.75C4.295 10.5967 4.25 10.43 4.25 10.25V9C4.25 8.74667 4.15333 8.48 3.96 8.2C3.85333 8.04 3.67 7.82333 3.41 7.55C3.27 7.41 3.17667 7.31 3.13 7.25ZM6.75 4.75H8L5.75 7.75V5.75H4.5L6.75 2.75V4.75Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </span>
                                <span>{item.summary}</span>
                              </p>
                            </div>
                          </div>

                          {item.showImage && (
                            <figure className="shaft-scalp-insights-image-wrap">
                              <div
                                className="shaft-scalp-insights-image"
                                style={{ backgroundImage: `url(${shaftScalpImage})` }}
                              />
                              <figcaption>Representative image</figcaption>
                            </figure>
                          )}

                          <div className="shaft-scalp-insights-action-block">
                            <p className="shaft-scalp-insights-action-title">Action Steps</p>
                            <ol className="shaft-scalp-insights-action-list">
                              {item.steps.map((step, index) => (
                                <li key={step}>
                                  <span
                                    className={`shaft-scalp-insights-action-number shaft-scalp-insights-action-number-${item.tone}`}
                                  >
                                    {index + 1}.
                                  </span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>

                          <div className="shaft-scalp-locked-container">
                            <div className="shaft-scalp-locked-content">
                              <span className="lock-icon" aria-hidden="true">
                                <svg
                                  width="17"
                                  height="16"
                                  viewBox="0 0 17 16"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M12.9919 6.66699H13.6582C13.8447 6.66699 14.0024 6.73144 14.1312 6.86033C14.26 6.98921 14.3244 7.14699 14.3244 7.33366V14.0003C14.3244 14.187 14.26 14.3448 14.1312 14.4737C14.0024 14.6025 13.8447 14.667 13.6582 14.667H2.99816C2.81161 14.667 2.65393 14.6025 2.52512 14.4737C2.39631 14.3448 2.33191 14.187 2.33191 14.0003V7.33366C2.33191 7.14699 2.39631 6.98921 2.52512 6.86033C2.65393 6.73144 2.81161 6.66699 2.99816 6.66699H3.66441V6.00033C3.66441 5.15588 3.87761 4.36922 4.30401 3.64033C4.71264 2.9381 5.26785 2.38255 5.96963 1.97366C6.69807 1.54699 7.48424 1.33366 8.32816 1.33366C9.17208 1.33366 9.95825 1.54699 10.6867 1.97366C11.3885 2.38255 11.9437 2.9381 12.3523 3.64033C12.7787 4.36922 12.9919 5.15588 12.9919 6.00033V6.66699ZM3.66441 8.00033V13.3337H12.9919V8.00033H3.66441ZM7.66191 9.33366H8.99441V12.0003H7.66191V9.33366ZM11.6594 6.66699V6.00033C11.6594 5.39588 11.5106 4.8381 11.213 4.32699C10.9154 3.81588 10.5112 3.41144 10.0004 3.11366C9.48966 2.81588 8.93223 2.66699 8.32816 2.66699C7.72409 2.66699 7.16666 2.81588 6.65587 3.11366C6.14508 3.41144 5.74089 3.81588 5.4433 4.32699C5.1457 4.8381 4.99691 5.39588 4.99691 6.00033V6.66699H11.6594Z"
                                    fill="#00E5FF"
                                  />
                                </svg>
                              </span>
                              <p className="lock-title">Unlock Full Shaft &amp; Scalp Insights</p>
                              <p className="lock-desc">
                                Access deeper scalp analysis and action priorities tailored to your report.
                              </p>
                              <button className="unlock-cta" onClick={handleUnlockReport}>
                                Unlock Full Plan
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="shaft-scalp-insights-summary-row">
                          <div className="shaft-scalp-insights-summary-main">
                            <p className="shaft-scalp-insights-summary-line">
                              <span
                                className={`shaft-scalp-insights-summary-icon shaft-scalp-insights-summary-icon-${item.tone}`}
                                aria-hidden="true"
                              >
                                <svg
                                  width="13"
                                  height="12"
                                  viewBox="0 0 13 12"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M5.24 8.75H7.26C7.29333 8.46333 7.38667 8.18333 7.54 7.91C7.67333 7.66333 7.87 7.39667 8.13 7.11L8.27 6.96C8.46333 6.76 8.57 6.65 8.59 6.63C8.80333 6.36333 8.96667 6.07 9.08 5.75C9.19333 5.43 9.25 5.09667 9.25 4.75C9.25 4.21 9.11333 3.70667 8.84 3.24C8.57333 2.78667 8.21333 2.42667 7.76 2.16C7.29333 1.88667 6.79 1.75 6.25 1.75C5.71 1.75 5.20667 1.88667 4.74 2.16C4.28667 2.42667 3.92667 2.78667 3.66 3.24C3.38667 3.70667 3.25 4.21 3.25 4.75C3.25 5.09667 3.30667 5.43 3.42 5.75C3.53333 6.07 3.69667 6.36 3.91 6.62C3.93 6.64667 4.03667 6.76 4.23 6.96L4.37 7.11C4.63 7.39667 4.82667 7.66333 4.96 7.91C5.11333 8.18333 5.20667 8.46333 5.24 8.75ZM7.25 9.75H5.25V10.25H7.25V9.75ZM3.13 7.25C2.85 6.90333 2.63333 6.52 2.48 6.1C2.32667 5.66667 2.25 5.21667 2.25 4.75C2.25 4.02333 2.43333 3.35 2.8 2.73C3.15333 2.13 3.63 1.65333 4.23 1.3C4.85 0.933333 5.52333 0.75 6.25 0.75C6.97667 0.75 7.65 0.933333 8.27 1.3C8.87 1.65333 9.34667 2.13 9.7 2.73C10.0667 3.35 10.25 4.02333 10.25 4.75C10.25 5.21667 10.1733 5.66667 10.02 6.1C9.86667 6.52 9.65 6.90333 9.37 7.25C9.32333 7.31 9.23 7.41 9.09 7.55C8.83 7.82333 8.64667 8.04 8.54 8.2C8.34667 8.48 8.25 8.74667 8.25 9V10.25C8.25 10.43 8.205 10.5967 8.115 10.75C8.025 10.9033 7.90333 11.025 7.75 11.115C7.59667 11.205 7.43 11.25 7.25 11.25H5.25C5.07 11.25 4.90333 11.205 4.75 11.115C4.59667 11.025 4.475 10.9033 4.385 10.75C4.295 10.5967 4.25 10.43 4.25 10.25V9C4.25 8.74667 4.15333 8.48 3.96 8.2C3.85333 8.04 3.67 7.82333 3.41 7.55C3.27 7.41 3.17667 7.31 3.13 7.25ZM6.75 4.75H8L5.75 7.75V5.75H4.5L6.75 2.75V4.75Z"
                                    fill="currentColor"
                                  />
                                </svg>
                              </span>
                              <span>{item.summary}</span>
                            </p>
                          </div>
                        </div>

                        {item.showImage && (
                          <figure className="shaft-scalp-insights-image-wrap">
                            <div
                              className="shaft-scalp-insights-image"
                              style={{ backgroundImage: `url(${shaftScalpImage})` }}
                            />
                            <figcaption>Representative image</figcaption>
                          </figure>
                        )}

                        <div className="shaft-scalp-insights-action-block">
                          <p className="shaft-scalp-insights-action-title">Action Steps</p>
                          <ol className="shaft-scalp-insights-action-list">
                            {item.steps.map((step, index) => (
                              <li key={step}>
                                <span
                                  className={`shaft-scalp-insights-action-number shaft-scalp-insights-action-number-${item.tone}`}
                                >
                                  {index + 1}.
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>

            <article className="shaft-scalp-insights-note-card">
              <p className="shaft-scalp-insights-note-title">
                <span
                  className="shaft-scalp-insights-note-icon"
                  aria-hidden="true"
                >
                  <svg
                    width="15"
                    height="14"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4.37352 1.45866V2.62533H3.20727V4.95866C3.20727 5.37866 3.31223 5.76755 3.52215 6.12533C3.73208 6.4831 4.01587 6.76699 4.37352 6.97699C4.73117 7.18699 5.11992 7.29199 5.53977 7.29199C5.95962 7.29199 6.34837 7.18699 6.70602 6.97699C7.06367 6.76699 7.34745 6.4831 7.55738 6.12533C7.7673 5.76755 7.87227 5.37866 7.87227 4.95866V2.62533H6.70602V1.45866H8.45539C8.61867 1.45866 8.75667 1.51505 8.86941 1.62783C8.98215 1.7406 9.03852 1.87866 9.03852 2.04199V4.95866C9.03852 5.52644 8.91023 6.05921 8.65365 6.55699C8.40485 7.04699 8.05692 7.45533 7.60986 7.78199C7.1628 8.10866 6.66714 8.31866 6.12289 8.41199V9.33366C6.12289 9.70699 6.21425 10.0492 6.39696 10.3603C6.57967 10.6714 6.82653 10.9184 7.13753 11.1012C7.44853 11.2839 7.79063 11.3753 8.16383 11.3753C8.59145 11.3753 8.9802 11.2528 9.33008 11.0078C9.67995 10.7628 9.92875 10.4459 10.0765 10.057C9.76548 9.91699 9.51473 9.7031 9.32425 9.41533C9.13376 9.12755 9.03852 8.80866 9.03852 8.45866C9.03852 8.13977 9.11627 7.84616 9.27177 7.57783C9.42727 7.30949 9.63913 7.09755 9.90737 6.94199C10.1756 6.78644 10.4691 6.70866 10.7879 6.70866C11.1067 6.70866 11.4002 6.78644 11.6684 6.94199C11.9366 7.09755 12.1485 7.30949 12.304 7.57783C12.4595 7.84616 12.5373 8.13977 12.5373 8.45866C12.5373 8.85533 12.4187 9.20921 12.1816 9.52033C11.9444 9.83144 11.6393 10.0375 11.2661 10.1387C11.1494 10.5975 10.9395 11.0098 10.6363 11.3753C10.3331 11.7409 9.96763 12.0267 9.54 12.2328C9.11238 12.4389 8.65365 12.542 8.16383 12.542C7.5807 12.542 7.04423 12.3981 6.5544 12.1103C6.06458 11.8225 5.67583 11.4337 5.38815 10.9437C5.10048 10.4537 4.95664 9.91699 4.95664 9.33366V8.41199C4.41239 8.31866 3.91673 8.10866 3.46967 7.78199C3.02261 7.45533 2.67468 7.04699 2.42588 6.55699C2.1693 6.05921 2.04102 5.52644 2.04102 4.95866V2.04199C2.04102 1.87866 2.09738 1.7406 2.21012 1.62783C2.32286 1.51505 2.46087 1.45866 2.62414 1.45866H4.37352ZM10.7879 7.87533C10.6246 7.87533 10.4866 7.93171 10.3739 8.04449C10.2611 8.15727 10.2048 8.29533 10.2048 8.45866C10.2048 8.62199 10.2611 8.76005 10.3739 8.87283C10.4866 8.9856 10.6246 9.04199 10.7879 9.04199C10.9512 9.04199 11.0892 8.9856 11.2019 8.87283C11.3146 8.76005 11.371 8.62199 11.371 8.45866C11.371 8.29533 11.3146 8.15727 11.2019 8.04449C11.0892 7.93171 10.9512 7.87533 10.7879 7.87533Z"
                      fill="#00E5FF"
                    />
                  </svg>
                </span>
                Clinical Note
              </p>
              <p className="shaft-scalp-insights-note-copy">
                Hair breakage (Q31), split ends (Q32), and texture quality (Q33)
                together form the <strong> Hair Shaft Integrity Index</strong>.
                Scalp oiliness (Q36) directly influences follicle
                microenvironment and DHT activity at the root. These factors
                respond well to the combined nutritional and lifestyle protocol
                above.
              </p>
            </article>
          </section>

          {/* Section: Recommended Blood Investigations */}
          <section
            className="blood-investigations-section"
            aria-label="Recommended Blood Investigations"
          >
            <header className="blood-investigations-header">
              <span
                className="blood-investigations-title-icon"
                aria-hidden="true"
              >
                <svg
                  width="19"
                  height="18"
                  viewBox="0 0 19 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.67 6.68984L9.375 2.96984L13.08 6.68984C13.76 7.35984 14.22 8.14984 14.46 9.05984C14.69 9.94984 14.69 10.8398 14.46 11.7298C14.22 12.6398 13.7625 13.4323 13.0875 14.1073C12.4125 14.7823 11.62 15.2398 10.71 15.4798C9.82 15.7098 8.93 15.7098 8.04 15.4798C7.13 15.2398 6.3375 14.7823 5.6625 14.1073C4.9875 13.4323 4.53 12.6398 4.29 11.7298C4.06 10.8398 4.06 9.94984 4.29 9.05984C4.53 8.14984 4.99 7.35984 5.67 6.68984ZM14.145 5.62484L9.375 0.854843L4.605 5.62484C3.735 6.48484 3.15 7.50484 2.85 8.68484C2.55 9.82484 2.55 10.9648 2.85 12.1048C3.15 13.2848 3.7325 14.3073 4.5975 15.1723C5.4625 16.0373 6.485 16.6248 7.665 16.9348C8.805 17.2248 9.945 17.2248 11.085 16.9348C12.265 16.6248 13.2875 16.0373 14.1525 15.1723C15.0175 14.3073 15.6 13.2848 15.9 12.1048C16.2 10.9648 16.2 9.82484 15.9 8.68484C15.6 7.50484 15.015 6.48484 14.145 5.62484ZM12.555 8.27984L11.49 7.21484L6.195 12.5248L7.26 13.5748L12.555 8.27984ZM6.465 9.07484C6.685 9.29484 6.95 9.40484 7.26 9.40484C7.57 9.40484 7.835 9.29484 8.055 9.07484C8.275 8.85484 8.385 8.58984 8.385 8.27984C8.385 7.96984 8.275 7.70484 8.055 7.48484C7.835 7.26484 7.57 7.15484 7.26 7.15484C6.95 7.15484 6.685 7.26484 6.465 7.48484C6.245 7.70484 6.135 7.96984 6.135 8.27984C6.135 8.58984 6.245 8.85484 6.465 9.07484ZM12.285 13.3198C12.065 13.5398 11.8 13.6498 11.49 13.6498C11.18 13.6498 10.915 13.5398 10.695 13.3198C10.475 13.0998 10.365 12.8348 10.365 12.5248C10.365 12.2148 10.475 11.9498 10.695 11.7298C10.915 11.5098 11.18 11.3998 11.49 11.3998C11.8 11.3998 12.065 11.5098 12.285 11.7298C12.505 11.9498 12.615 12.2148 12.615 12.5248C12.615 12.8348 12.505 13.0998 12.285 13.3198Z"
                    fill="#EF4444"
                  />
                </svg>
              </span>
              <div className="blood-investigations-head-copy">
                <div className="blood-investigations-title-row">
                  <h3>Recommended Blood Investigations</h3>
                  <span className="blood-investigations-chip">
                    LAB INVESTIGATIONS
                  </span>
                </div>
                <p>First-line laboratory tests for trichology consultation</p>
              </div>
            </header>

            <div className="blood-investigations-divider" aria-hidden="true" />

            <article className="blood-investigations-note-card">
              <p className="blood-investigations-note-title">
                <span
                  className="blood-investigations-note-icon"
                  aria-hidden="true"
                >
                  <svg
                    width="15"
                    height="14"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4.37352 1.45866V2.62533H3.20727V4.95866C3.20727 5.37866 3.31223 5.76755 3.52215 6.12533C3.73208 6.4831 4.01587 6.76699 4.37352 6.97699C4.73117 7.18699 5.11992 7.29199 5.53977 7.29199C5.95962 7.29199 6.34837 7.18699 6.70602 6.97699C7.06367 6.76699 7.34745 6.4831 7.55738 6.12533C7.7673 5.76755 7.87227 5.37866 7.87227 4.95866V2.62533H6.70602V1.45866H8.45539C8.61867 1.45866 8.75667 1.51505 8.86941 1.62783C8.98215 1.7406 9.03852 1.87866 9.03852 2.04199V4.95866C9.03852 5.52644 8.91023 6.05921 8.65365 6.55699C8.40485 7.04699 8.05692 7.45533 7.60986 7.78199C7.1628 8.10866 6.66714 8.31866 6.12289 8.41199V9.33366C6.12289 9.70699 6.21425 10.0492 6.39696 10.3603C6.57967 10.6714 6.82653 10.9184 7.13753 11.1012C7.44853 11.2839 7.79063 11.3753 8.16383 11.3753C8.59145 11.3753 8.9802 11.2528 9.33008 11.0078C9.67995 10.7628 9.92875 10.4459 10.0765 10.057C9.76548 9.91699 9.51473 9.7031 9.32425 9.41533C9.13376 9.12755 9.03852 8.80866 9.03852 8.45866C9.03852 8.13977 9.11627 7.84616 9.27177 7.57783C9.42727 7.30949 9.63913 7.09755 9.90737 6.94199C10.1756 6.78644 10.4691 6.70866 10.7879 6.70866C11.1067 6.70866 11.4002 6.78644 11.6684 6.94199C11.9366 7.09755 12.1485 7.30949 12.304 7.57783C12.4595 7.84616 12.5373 8.13977 12.5373 8.45866C12.5373 8.85533 12.4187 9.20921 12.1816 9.52033C11.9444 9.83144 11.6393 10.0375 11.2661 10.1387C11.1494 10.5975 10.9395 11.0098 10.6363 11.3753C10.3331 11.7409 9.96763 12.0267 9.54 12.2328C9.11238 12.4389 8.65365 12.542 8.16383 12.542C7.5807 12.542 7.04423 12.3981 6.5544 12.1103C6.06458 11.8225 5.67583 11.4337 5.38815 10.9437C5.10048 10.4537 4.95664 9.91699 4.95664 9.33366V8.41199C4.41239 8.31866 3.91673 8.10866 3.46967 7.78199C3.02261 7.45533 2.67468 7.04699 2.42588 6.55699C2.1693 6.05921 2.04102 5.52644 2.04102 4.95866V2.04199C2.04102 1.87866 2.09738 1.7406 2.21012 1.62783C2.32286 1.51505 2.46087 1.45866 2.62414 1.45866H4.37352ZM10.7879 7.87533C10.6246 7.87533 10.4866 7.93171 10.3739 8.04449C10.2611 8.15727 10.2048 8.29533 10.2048 8.45866C10.2048 8.62199 10.2611 8.76005 10.3739 8.87283C10.4866 8.9856 10.6246 9.04199 10.7879 9.04199C10.9512 9.04199 11.0892 8.9856 11.2019 8.87283C11.3146 8.76005 11.371 8.62199 11.371 8.45866C11.371 8.29533 11.3146 8.15727 11.2019 8.04449C11.0892 7.93171 10.9512 7.87533 10.7879 7.87533Z"
                      fill="#EF4444"
                    />
                  </svg>
                </span>
                Clinical Note
              </p>
              <p className="blood-investigations-note-copy">
                Blood tests are essential first-line investigations in any
                trichology consultation. No AI diagnostic tool - including
                TrichoScan - can substitute laboratory data. These tests are
                recommended regardless of assessment findings and should be done
                <strong> before initiating any treatment.</strong>
              </p>
            </article>

            <div className="blood-investigations-grid">
              {bloodInvestigationCards.map((item) => (
                <article className="blood-investigations-card" key={item.title}>
                  <div className="blood-investigations-card-head">
                    <span
                      className={`blood-investigations-card-icon blood-investigations-card-icon-${item.tone}`}
                      aria-hidden="true"
                    >
                      {item.icon === "cbc" && (
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M10.2048 1.16634V2.33301H9.62166V10.4997C9.62166 10.9197 9.5167 11.3086 9.30677 11.6663C9.09685 12.0241 8.81306 12.308 8.45541 12.518C8.09776 12.728 7.70901 12.833 7.28916 12.833C6.86931 12.833 6.48056 12.728 6.12291 12.518C5.76526 12.308 5.48147 12.0241 5.27155 11.6663C5.06162 11.3086 4.95666 10.9197 4.95666 10.4997V2.33301H4.37354V1.16634H10.2048ZM8.45541 5.83301H6.12291V10.4997C6.12291 10.7097 6.17539 10.9041 6.28035 11.083C6.38532 11.2619 6.52721 11.4038 6.70604 11.5088C6.88486 11.6138 7.07924 11.6663 7.28916 11.6663C7.49909 11.6663 7.69346 11.6138 7.87229 11.5088C8.05111 11.4038 8.193 11.2619 8.29797 11.083C8.40293 10.9041 8.45541 10.7097 8.45541 10.4997V5.83301ZM7.87229 8.74967C8.03556 8.74967 8.17357 8.80606 8.2863 8.91884C8.39904 9.03162 8.45541 9.16967 8.45541 9.33301C8.45541 9.49634 8.39904 9.6344 8.2863 9.74717C8.17357 9.85995 8.03556 9.91634 7.87229 9.91634C7.70901 9.91634 7.571 9.85995 7.45827 9.74717C7.34553 9.6344 7.28916 9.49634 7.28916 9.33301C7.28916 9.16967 7.34553 9.03162 7.45827 8.91884C7.571 8.80606 7.70901 8.74967 7.87229 8.74967ZM6.70604 6.99967C6.86931 6.99967 7.00732 7.05606 7.12005 7.16884C7.23279 7.28162 7.28916 7.41967 7.28916 7.58301C7.28916 7.74634 7.23279 7.8844 7.12005 7.99717C7.00732 8.10995 6.86931 8.16634 6.70604 8.16634C6.54276 8.16634 6.40475 8.10995 6.29202 7.99717C6.17928 7.8844 6.12291 7.74634 6.12291 7.58301C6.12291 7.41967 6.17928 7.28162 6.29202 7.16884C6.40475 7.05606 6.54276 6.99967 6.70604 6.99967ZM8.45541 2.33301H6.12291V4.66634H8.45541V2.33301Z"
                            fill="#00E5FF"
                          />
                        </svg>
                      )}
                      {item.icon === "ferritin" && (
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M3.58047 4.37499L7.28914 0.664987L10.9978 4.37499C11.6742 5.04388 12.1291 5.83721 12.3623 6.75499C12.5956 7.64165 12.5956 8.52832 12.3623 9.41499C12.1291 10.3328 11.6762 11.128 11.0036 11.8008C10.3311 12.4736 9.53612 12.9305 8.61867 13.1717C7.73232 13.3972 6.84597 13.3972 5.95962 13.1717C5.04217 12.9305 4.24717 12.4736 3.57463 11.8008C2.9021 11.128 2.4492 10.3328 2.21595 9.41499C1.9827 8.52832 1.9827 7.64165 2.21595 6.75499C2.4492 5.83721 2.90404 5.04388 3.58047 4.37499Z"
                            fill="#EF4444"
                          />
                        </svg>
                      )}
                      {item.icon === "tsh" && (
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M10.2045 1.59798C10.7876 1.59798 11.3241 1.74965 11.8139 2.05298C12.3037 2.35631 12.6886 2.76854 12.9685 3.28965C13.2639 3.83409 13.4116 4.43687 13.4116 5.09798C13.4116 6.0002 13.2017 6.86743 12.7819 7.69965C12.4242 8.40743 11.915 9.08798 11.2541 9.74132C10.7409 10.2546 10.1306 10.7563 9.42307 11.2463C9.02654 11.5185 8.50562 11.8452 7.86029 12.2263L7.58039 12.3896L7.30049 12.2263C6.62407 11.8296 6.07982 11.4874 5.66774 11.1996C4.92912 10.6863 4.29545 10.1574 3.76675 9.61298C3.0981 8.91298 2.59273 8.18965 2.25063 7.44298L1.16602 7.43131V6.26465L1.87743 6.27632C1.7919 5.88743 1.74914 5.49465 1.74914 5.09798C1.74914 4.43687 1.89687 3.83409 2.19232 3.28965C2.47222 2.76854 2.85708 2.35631 3.3469 2.05298C3.83673 1.74965 4.3732 1.59798 4.95633 1.59798C5.4617 1.59798 5.96319 1.72243 6.46079 1.97132C6.88064 2.17354 7.25384 2.43798 7.58039 2.76465C7.90694 2.43798 8.28014 2.17354 8.69999 1.97132C9.19759 1.72243 9.69908 1.59798 10.2045 1.59798ZM10.2045 2.76465C9.89345 2.76465 9.57857 2.84048 9.25979 2.99215C8.94102 3.14382 8.65723 3.34409 8.40843 3.59298L7.58039 4.42132L6.75235 3.59298C6.50355 3.34409 6.21977 3.14382 5.90099 2.99215C5.58222 2.84048 5.26733 2.76465 4.95633 2.76465C4.58313 2.76465 4.24103 2.86576 3.93003 3.06798C3.61903 3.2702 3.37217 3.54826 3.18946 3.90215C3.00675 4.25604 2.91539 4.65854 2.91539 5.10965C2.91539 5.49854 2.96593 5.88743 3.067 6.27632L4.33822 6.26465L5.53945 4.25798L7.28883 7.17465L7.83697 6.26465H10.496V7.43131H8.49007L7.28883 9.44965L5.53945 6.53298L4.99132 7.43131L3.55683 7.44298C4.00778 8.22076 4.69587 8.97909 5.62109 9.71798C6.03317 10.0446 6.50355 10.3752 7.03225 10.7096C7.19553 10.8108 7.37824 10.9196 7.58039 11.0363C7.78254 10.9196 7.96525 10.8108 8.12853 10.7096C8.65723 10.3752 9.12762 10.0446 9.53969 9.71798C10.426 9.0102 11.0947 8.28298 11.5456 7.53631C12.0121 6.75854 12.2454 5.94965 12.2454 5.10965C12.2454 4.65854 12.156 4.25409 11.9772 3.89631C11.7983 3.53854 11.5534 3.26243 11.2424 3.06798C10.9314 2.87354 10.5854 2.77243 10.2045 2.76465Z"
                            fill="#EF4444"
                          />
                        </svg>
                      )}
                      {item.icon === "free-t3-t4" && (
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M5.53951 4.39876L9.03826 12.5654L11.1725 7.58376H13.7033V6.4171H10.4028L9.03826 9.6021L5.53951 1.43543L3.40527 6.4171H0.874512V7.58376H4.175L5.53951 4.39876Z"
                            fill="#A78BFA"
                          />
                        </svg>
                      )}
                      {item.icon === "dheas" && (
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M11.8258 2.4621C12.2767 2.91321 12.58 3.4421 12.7355 4.04876C12.891 4.63987 12.891 5.23099 12.7355 5.8221C12.58 6.43654 12.2767 6.96543 11.8258 7.40876L7.69727 11.5388C7.2541 11.9899 6.7254 12.2932 6.11117 12.4488C5.52027 12.6043 4.92937 12.6043 4.33847 12.4488C3.73202 12.2932 3.20332 11.9899 2.75237 11.5388C2.30142 11.0877 1.9982 10.5588 1.8427 9.9521C1.6872 9.36099 1.6872 8.76987 1.8427 8.17876C1.9982 7.56432 2.30142 7.03543 2.75237 6.5921L6.8809 2.4621C7.32407 2.01099 7.85277 1.70765 8.467 1.5521C9.0579 1.39654 9.6488 1.39654 10.2397 1.5521C10.8461 1.70765 11.3748 2.01099 11.8258 2.4621ZM8.52531 9.06543L5.22482 5.76376L3.58041 7.40876C3.27719 7.7121 3.07309 8.06404 2.96813 8.4646C2.86317 8.86515 2.86317 9.26571 2.96813 9.66626C3.07309 10.0668 3.27524 10.4168 3.57458 10.7163C3.87392 11.0157 4.22379 11.2179 4.62421 11.3229C5.02462 11.4279 5.42503 11.4279 5.82544 11.3229C6.22586 11.2179 6.57767 11.0138 6.8809 10.7104L8.52531 9.06543ZM10.9978 3.29043C10.7023 2.9871 10.3544 2.78293 9.95397 2.67793C9.55356 2.57293 9.15314 2.57293 8.75273 2.67793C8.35232 2.78293 8.0005 2.9871 7.69727 3.29043L6.05286 4.93543L9.35335 8.2371L10.9978 6.5921C11.301 6.28876 11.5051 5.93682 11.61 5.53626C11.715 5.13571 11.715 4.73515 11.61 4.3346C11.5051 3.93404 11.301 3.58599 10.9978 3.29043Z"
                            fill="#F59E0B"
                          />
                        </svg>
                      )}
                      {item.icon === "testosterone" && (
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M3.20727 4.08301C3.20727 3.8419 3.29279 3.63579 3.46384 3.46467C3.63489 3.29356 3.84093 3.20801 4.08195 3.20801C4.32298 3.20801 4.52902 3.29356 4.70007 3.46467C4.87112 3.63579 4.95664 3.8419 4.95664 4.08301C4.95664 4.32412 4.87112 4.53023 4.70007 4.70134C4.52902 4.87245 4.32298 4.95801 4.08195 4.95801C3.84093 4.95801 3.63489 4.87245 3.46384 4.70134C3.29279 4.53023 3.20727 4.32412 3.20727 4.08301ZM4.08195 2.04134C3.70875 2.04134 3.36665 2.13273 3.05565 2.31551C2.74465 2.49829 2.4978 2.74523 2.31508 3.05634C2.13237 3.36745 2.04102 3.70967 2.04102 4.08301C2.04102 4.45634 2.13237 4.79856 2.31508 5.10967C2.4978 5.42079 2.74465 5.66773 3.05565 5.85051C3.36665 6.03329 3.70875 6.12467 4.08195 6.12467C4.45515 6.12467 4.79725 6.03329 5.10825 5.85051C5.41925 5.66773 5.66611 5.42079 5.84882 5.10967C6.03153 4.79856 6.12289 4.45634 6.12289 4.08301C6.12289 3.70967 6.03153 3.36745 5.84882 3.05634C5.66611 2.74523 5.41925 2.49829 5.10825 2.31551C4.79725 2.13273 4.45515 2.04134 4.08195 2.04134ZM7.28914 4.66634H11.9541V3.49967H7.28914V4.66634ZM9.62164 9.91634C9.62164 9.67523 9.70717 9.46912 9.87822 9.29801C10.0493 9.1269 10.2553 9.04134 10.4963 9.04134C10.7374 9.04134 10.9434 9.1269 11.1144 9.29801C11.2855 9.46912 11.371 9.67523 11.371 9.91634C11.371 10.1575 11.2855 10.3636 11.1144 10.5347C10.9434 10.7058 10.7374 10.7913 10.4963 10.7913C10.2553 10.7913 10.0493 10.7058 9.87822 10.5347C9.70717 10.3636 9.62164 10.1575 9.62164 9.91634ZM10.4963 7.87467C10.1231 7.87467 9.78103 7.96606 9.47003 8.14884C9.15903 8.33162 8.91217 8.57856 8.72946 8.88967C8.54675 9.20079 8.45539 9.54301 8.45539 9.91634C8.45539 10.2897 8.54675 10.6319 8.72946 10.943C8.91217 11.2541 9.15903 11.5011 9.47003 11.6838C9.78103 11.8666 10.1231 11.958 10.4963 11.958C10.8695 11.958 11.2116 11.8666 11.5226 11.6838C11.8336 11.5011 12.0805 11.2541 12.2632 10.943C12.4459 10.6319 12.5373 10.2897 12.5373 9.91634C12.5373 9.54301 12.4459 9.20079 12.2632 8.88967C12.0805 8.57856 11.8336 8.33162 11.5226 8.14884C11.2116 7.96606 10.8695 7.87467 10.4963 7.87467ZM2.62414 9.33301V10.4997H7.28914V9.33301H2.62414Z"
                            fill="#00E5FF"
                          />
                        </svg>
                      )}
                      {item.icon === "prolactin" && (
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M9.62156 1.16634V2.33301H9.03844V4.22301C9.03844 4.90745 9.18227 5.56079 9.46995 6.18301L11.9657 11.5963C12.0668 11.8141 12.0746 12.0358 11.989 12.2613C11.9035 12.4869 11.7519 12.6502 11.5342 12.7513C11.4176 12.8058 11.2971 12.833 11.1727 12.833H3.40545C3.16442 12.833 2.95839 12.7475 2.78734 12.5763C2.61629 12.4052 2.53076 12.1991 2.53076 11.958C2.53076 11.8336 2.55797 11.713 2.6124 11.5963L5.10817 6.18301C5.39585 5.56079 5.53969 4.90745 5.53969 4.22301V2.33301H4.95656V1.16634H9.62156ZM8.09377 5.83301H6.48435C6.42215 6.04301 6.34829 6.25301 6.26276 6.46301L6.16946 6.67301L3.86029 11.6663H10.7178L8.40866 6.67301C8.28426 6.40079 8.1793 6.12079 8.09377 5.83301ZM6.70594 4.22301C6.70594 4.37079 6.70205 4.51856 6.69427 4.66634H7.88385L7.87219 4.45634V4.22301V2.33301H6.70594V4.22301Z"
                            fill="#34D399"
                          />
                        </svg>
                      )}
                      {item.icon === "zinc" && (
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M4.37357 6.70866C3.8993 6.70866 3.46196 6.59005 3.06154 6.35283C2.66113 6.1156 2.34236 5.79671 2.10522 5.39616C1.86808 4.9956 1.74951 4.5581 1.74951 4.08366C1.74951 3.60921 1.86808 3.17171 2.10522 2.77116C2.34236 2.3706 2.66113 2.05171 3.06154 1.81449C3.46196 1.57727 3.8993 1.45866 4.37357 1.45866C4.84785 1.45866 5.28519 1.57727 5.68561 1.81449C6.08602 2.05171 6.40479 2.3706 6.64193 2.77116C6.87907 3.17171 6.99764 3.60921 6.99764 4.08366C6.99764 4.5581 6.87907 4.9956 6.64193 5.39616C6.40479 5.79671 6.08602 6.1156 5.68561 6.35283C5.28519 6.59005 4.84785 6.70866 4.37357 6.70866ZM4.37357 12.542C3.8993 12.542 3.46196 12.4234 3.06154 12.1862C2.66113 11.9489 2.34236 11.63 2.10522 11.2295C1.86808 10.8289 1.74951 10.3914 1.74951 9.91699C1.74951 9.44255 1.86808 9.00505 2.10522 8.60449C2.34236 8.20394 2.66113 7.88505 3.06154 7.64783C3.46196 7.4106 3.8993 7.29199 4.37357 7.29199C4.84785 7.29199 5.28519 7.4106 5.68561 7.64783C6.08602 7.88505 6.40479 8.20394 6.64193 8.60449C6.87907 9.00505 6.99764 9.44255 6.99764 9.91699C6.99764 10.3914 6.87907 10.8289 6.64193 11.2295C6.40479 11.63 6.08602 11.9489 5.68561 12.1862C5.28519 12.4234 4.84785 12.542 4.37357 12.542ZM10.2048 6.70866C9.73055 6.70866 9.29321 6.59005 8.89279 6.35283C8.49238 6.1156 8.17361 5.79671 7.93647 5.39616C7.69933 4.9956 7.58076 4.5581 7.58076 4.08366C7.58076 3.60921 7.69933 3.17171 7.93647 2.77116C8.17361 2.3706 8.49238 2.05171 8.89279 1.81449C9.29321 1.57727 9.73055 1.45866 10.2048 1.45866C10.6791 1.45866 11.1164 1.57727 11.5169 1.81449C11.9173 2.05171 12.236 2.3706 12.4732 2.77116C12.7103 3.17171 12.8289 3.60921 12.8289 4.08366C12.8289 4.5581 12.7103 4.9956 12.4732 5.39616C12.236 5.79671 11.9173 6.1156 11.5169 6.35283C11.1164 6.59005 10.6791 6.70866 10.2048 6.70866ZM10.2048 12.542C9.73055 12.542 9.29321 12.4234 8.89279 12.1862C8.49238 11.9489 8.17361 11.63 7.93647 11.2295C7.69933 10.8289 7.58076 10.3914 7.58076 9.91699C7.58076 9.44255 7.69933 9.00505 7.93647 8.60449C8.17361 8.20394 8.49238 7.88505 8.89279 7.64783C9.29321 7.4106 9.73055 7.29199 10.2048 7.29199C10.6791 7.29199 11.1164 7.4106 11.5169 7.64783C11.9173 7.88505 12.236 8.20394 12.4732 8.60449C12.7103 9.00505 12.8289 9.44255 12.8289 9.91699C12.8289 10.3914 12.7103 10.8289 12.4732 11.2295C12.236 11.63 11.9173 11.9489 11.5169 12.1862C11.1164 12.4234 10.6791 12.542 10.2048 12.542ZM4.37357 5.54199C4.63792 5.54199 4.88089 5.47588 5.10248 5.34366C5.32407 5.21144 5.50095 5.03449 5.63312 4.81283C5.7653 4.59116 5.83139 4.3481 5.83139 4.08366C5.83139 3.81921 5.7653 3.57616 5.63312 3.35449C5.50095 3.13283 5.32407 2.95588 5.10248 2.82366C4.88089 2.69144 4.63792 2.62533 4.37357 2.62533C4.10922 2.62533 3.86626 2.69144 3.64467 2.82366C3.42308 2.95588 3.2462 3.13283 3.11402 3.35449C2.98185 3.57616 2.91576 3.81921 2.91576 4.08366C2.91576 4.3481 2.98185 4.59116 3.11402 4.81283C3.2462 5.03449 3.42308 5.21144 3.64467 5.34366C3.86626 5.47588 4.10922 5.54199 4.37357 5.54199ZM4.37357 11.3753C4.63792 11.3753 4.88089 11.3092 5.10248 11.177C5.32407 11.0448 5.50095 10.8678 5.63312 10.6462C5.7653 10.4245 5.83139 10.1814 5.83139 9.91699C5.83139 9.65255 5.7653 9.40949 5.63312 9.18783C5.50095 8.96616 5.32407 8.78921 5.10248 8.65699C4.88089 8.52477 4.63792 8.45866 4.37357 8.45866C4.10922 8.45866 3.86626 8.52477 3.64467 8.65699C3.42308 8.78921 3.2462 8.96616 3.11402 9.18783C2.98185 9.40949 2.91576 9.65255 2.91576 9.91699C2.91576 10.1814 2.98185 10.4245 3.11402 10.6462C3.2462 10.8678 3.42308 11.0448 3.64467 11.177C3.86626 11.3092 4.10922 11.3753 4.37357 11.3753ZM10.2048 5.54199C10.4692 5.54199 10.7121 5.47588 10.9337 5.34366C11.1553 5.21144 11.3322 5.03449 11.4644 4.81283C11.5965 4.59116 11.6626 4.3481 11.6626 4.08366C11.6626 3.81921 11.5965 3.57616 11.4644 3.35449C11.3322 3.13283 11.1553 2.95588 10.9337 2.82366C10.7121 2.69144 10.4692 2.62533 10.2048 2.62533C9.94047 2.62533 9.69751 2.69144 9.47592 2.82366C9.25433 2.95588 9.07745 3.13283 8.94527 3.35449C8.8131 3.57616 8.74701 3.81921 8.74701 4.08366C8.74701 4.3481 8.8131 4.59116 8.94527 4.81283C9.07745 5.03449 9.25433 5.21144 9.47592 5.34366C9.69751 5.47588 9.94047 5.54199 10.2048 5.54199ZM10.2048 11.3753C10.4692 11.3753 10.7121 11.3092 10.9337 11.177C11.1553 11.0448 11.3322 10.8678 11.4644 10.6462C11.5965 10.4245 11.6626 10.1814 11.6626 9.91699C11.6626 9.65255 11.5965 9.40949 11.4644 9.18783C11.3322 8.96616 11.1553 8.78921 10.9337 8.65699C10.7121 8.52477 10.4692 8.45866 10.2048 8.45866C9.94047 8.45866 9.69751 8.52477 9.47592 8.65699C9.25433 8.78921 9.07745 8.96616 8.94527 9.18783C8.8131 9.40949 8.74701 9.65255 8.74701 9.91699C8.74701 10.1814 8.8131 10.4245 8.94527 10.6462C9.07745 10.8678 9.25433 11.0448 9.47592 11.177C9.69751 11.3092 9.94047 11.3753 10.2048 11.3753Z"
                            fill="#34D399"
                          />
                        </svg>
                      )}
                      {item.icon === "vitamin-d3" && (
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M7.28889 10.5003C6.65911 10.5003 6.0721 10.3409 5.52785 10.022C4.99915 9.71088 4.5793 9.29088 4.2683 8.76199C3.94952 8.21755 3.79014 7.63033 3.79014 7.00033C3.79014 6.37033 3.94952 5.7831 4.2683 5.23866C4.5793 4.70977 4.99915 4.28977 5.52785 3.97866C6.0721 3.65977 6.65911 3.50033 7.28889 3.50033C7.91866 3.50033 8.50567 3.65977 9.04992 3.97866C9.57862 4.28977 9.99847 4.70977 10.3095 5.23866C10.6282 5.7831 10.7876 6.37033 10.7876 7.00033C10.7876 7.63033 10.6282 8.21755 10.3095 8.76199C9.99847 9.29088 9.57862 9.71088 9.04992 10.022C8.50567 10.3409 7.91866 10.5003 7.28889 10.5003ZM7.28889 9.33366C7.70874 9.33366 8.09749 9.22866 8.45514 9.01866C8.81279 8.80866 9.09657 8.52477 9.3065 8.16699C9.51642 7.80921 9.62139 7.42033 9.62139 7.00033C9.62139 6.58033 9.51642 6.19144 9.3065 5.83366C9.09657 5.47588 8.81279 5.19199 8.45514 4.98199C8.09749 4.77199 7.70874 4.66699 7.28889 4.66699C6.86904 4.66699 6.48029 4.77199 6.12264 4.98199C5.76499 5.19199 5.4812 5.47588 5.27127 5.83366C5.06135 6.19144 4.95639 6.58033 4.95639 7.00033C4.95639 7.42033 5.06135 7.80921 5.27127 8.16699C5.4812 8.52477 5.76499 8.80866 6.12264 9.01866C6.48029 9.22866 6.86904 9.33366 7.28889 9.33366ZM6.70576 0.583659H7.87201V2.33366H6.70576V0.583659ZM6.70576 11.667H7.87201V13.417H6.70576V11.667ZM2.34399 2.87033L3.16036 2.05366L4.40825 3.29033L3.58021 4.11866L2.34399 2.87033ZM10.1695 10.7103L10.9976 9.88199L12.2338 11.1303L11.4174 11.947L10.1695 10.7103ZM11.4174 2.05366L12.2338 2.87033L10.9976 4.11866L10.1695 3.29033L11.4174 2.05366ZM3.58021 9.88199L4.40825 10.7103L3.16036 11.947L2.34399 11.1303L3.58021 9.88199ZM13.7033 6.41699V7.58366H11.9539V6.41699H13.7033ZM2.62389 6.41699V7.58366H0.874512V6.41699H2.62389Z"
                            fill="#00E5FF"
                          />
                        </svg>
                      )}
                      {item.icon === "glucose" && (
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M10.2048 9.33301C10.5235 9.33301 10.817 9.41079 11.0853 9.56634C11.3535 9.7219 11.5654 9.93384 11.7209 10.2022C11.8764 10.4705 11.9541 10.7641 11.9541 11.083C11.9541 11.4019 11.8764 11.6955 11.7209 11.9638C11.5654 12.2322 11.3535 12.4441 11.0853 12.5997C10.817 12.7552 10.5235 12.833 10.2048 12.833C9.88599 12.833 9.59248 12.7552 9.32425 12.5997C9.05601 12.4441 8.84414 12.2322 8.68864 11.9638C8.53314 11.6955 8.45539 11.4019 8.45539 11.083C8.45539 10.7641 8.53314 10.4705 8.68864 10.2022C8.84414 9.93384 9.05601 9.7219 9.32425 9.56634C9.59248 9.41079 9.88599 9.33301 10.2048 9.33301ZM4.37352 6.99967C4.79337 6.99967 5.18212 7.10467 5.53977 7.31467C5.89742 7.52467 6.1812 7.80856 6.39113 8.16634C6.60105 8.52412 6.70602 8.91301 6.70602 9.33301C6.70602 9.75301 6.60105 10.1419 6.39113 10.4997C6.1812 10.8575 5.89742 11.1413 5.53977 11.3513C5.18212 11.5613 4.79337 11.6663 4.37352 11.6663C3.95367 11.6663 3.56492 11.5613 3.20727 11.3513C2.84962 11.1413 2.56583 10.8575 2.3559 10.4997C2.14598 10.1419 2.04102 9.75301 2.04102 9.33301C2.04102 8.91301 2.14598 8.52412 2.3559 8.16634C2.56583 7.80856 2.84962 7.52467 3.20727 7.31467C3.56492 7.10467 3.95367 6.99967 4.37352 6.99967ZM10.2048 10.4997C10.0415 10.4997 9.90348 10.5561 9.79075 10.6688C9.67801 10.7816 9.62164 10.9197 9.62164 11.083C9.62164 11.2463 9.67801 11.3844 9.79075 11.4972C9.90348 11.61 10.0415 11.6663 10.2048 11.6663C10.368 11.6663 10.506 11.61 10.6188 11.4972C10.7315 11.3844 10.7879 11.2463 10.7879 11.083C10.7879 10.9197 10.7315 10.7816 10.6188 10.6688C10.506 10.5561 10.368 10.4997 10.2048 10.4997ZM4.37352 8.16634C4.16359 8.16634 3.96922 8.21884 3.79039 8.32384C3.61157 8.42884 3.46967 8.57079 3.36471 8.74967C3.25975 8.92856 3.20727 9.12301 3.20727 9.33301C3.20727 9.54301 3.25975 9.73745 3.36471 9.91634C3.46967 10.0952 3.61157 10.2372 3.79039 10.3422C3.96922 10.4472 4.16359 10.4997 4.37352 10.4997C4.58344 10.4997 4.77782 10.4472 4.95664 10.3422C5.13547 10.2372 5.27736 10.0952 5.38232 9.91634C5.48728 9.73745 5.53977 9.54301 5.53977 9.33301C5.53977 9.12301 5.48728 8.92856 5.38232 8.74967C5.27736 8.57079 5.13547 8.42884 4.95664 8.32384C4.77782 8.21884 4.58344 8.16634 4.37352 8.16634ZM9.33008 1.16634C9.9132 1.16634 10.4497 1.31023 10.9395 1.59801C11.4293 1.88579 11.8181 2.27467 12.1058 2.76467C12.3934 3.25467 12.5373 3.79134 12.5373 4.37467C12.5373 4.95801 12.3934 5.49467 12.1058 5.98467C11.8181 6.47467 11.4293 6.86356 10.9395 7.15134C10.4497 7.43912 9.9132 7.58301 9.33008 7.58301C8.74695 7.58301 8.21048 7.43912 7.72065 7.15134C7.23083 6.86356 6.84208 6.47467 6.5544 5.98467C6.26673 5.49467 6.12289 4.95801 6.12289 4.37467C6.12289 3.79134 6.26673 3.25467 6.5544 2.76467C6.84208 2.27467 7.23083 1.88579 7.72065 1.59801C8.21048 1.31023 8.74695 1.16634 9.33008 1.16634ZM9.33008 2.33301C8.95688 2.33301 8.61478 2.4244 8.30378 2.60717C7.99278 2.78995 7.74592 3.0369 7.56321 3.34801C7.3805 3.65912 7.28914 4.00134 7.28914 4.37467C7.28914 4.74801 7.3805 5.09023 7.56321 5.40134C7.74592 5.71245 7.99278 5.9594 8.30378 6.14217C8.61478 6.32495 8.95688 6.41634 9.33008 6.41634C9.70328 6.41634 10.0454 6.32495 10.3564 6.14217C10.6674 5.9594 10.9142 5.71245 11.0969 5.40134C11.2797 5.09023 11.371 4.74801 11.371 4.37467C11.371 4.00134 11.2797 3.65912 11.0969 3.34801C10.9142 3.0369 10.6674 2.78995 10.3564 2.60717C10.0454 2.4244 9.70328 2.33301 9.33008 2.33301Z"
                            fill="#F59E0B"
                          />
                        </svg>
                      )}
                    </span>
                    <h4>{item.title}</h4>
                  </div>

                  <p className="blood-investigations-card-desc">{item.desc}</p>

                  <div className="blood-investigations-card-foot">
                    <span
                      className={`blood-investigations-status-label blood-investigations-status-label-${item.tone}`}
                    >
                      Status
                    </span>
                    <span
                      className={`blood-investigations-status-pill blood-investigations-status-pill-${item.tone}`}
                    >
                      {item.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <article className="blood-investigations-tip-card">
              <p className="blood-investigations-tip-title">
                <span
                  className="blood-investigations-tip-icon"
                  aria-hidden="true"
                >
                  <svg
                    width="15"
                    height="14"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6.11111 10.2083H8.46694C8.50581 9.87389 8.61466 9.54722 8.79349 9.22833C8.94899 8.94056 9.17835 8.62944 9.48157 8.295L9.64485 8.12C9.87032 7.88667 9.99472 7.75833 10.018 7.735C10.2668 7.42389 10.4573 7.08167 10.5895 6.70833C10.7217 6.335 10.7878 5.94611 10.7878 5.54167C10.7878 4.91167 10.6284 4.32444 10.3096 3.78C9.99861 3.25111 9.57876 2.83111 9.05006 2.52C8.50581 2.20111 7.9188 2.04167 7.28902 2.04167C6.65925 2.04167 6.07224 2.20111 5.52799 2.52C4.99929 2.83111 4.57944 3.25111 4.26844 3.78C3.94966 4.32444 3.79027 4.91167 3.79027 5.54167C3.79027 5.94611 3.85636 6.335 3.98854 6.70833C4.12071 7.08167 4.3112 7.42 4.56 7.72333C4.58332 7.75444 4.70772 7.88667 4.9332 8.12L5.09647 8.295C5.3997 8.62944 5.62906 8.94056 5.78456 9.22833C5.96339 9.54722 6.07224 9.87389 6.11111 10.2083ZM8.45527 11.375H6.12277V11.9583H8.45527V11.375ZM3.65032 8.45833C3.32377 8.05389 3.07109 7.60667 2.89226 7.11667C2.71344 6.61111 2.62402 6.08611 2.62402 5.54167C2.62402 4.69389 2.83784 3.90833 3.26546 3.185C3.67754 2.485 4.23345 1.92889 4.9332 1.51667C5.65627 1.08889 6.44155 0.875 7.28902 0.875C8.1365 0.875 8.92177 1.08889 9.64485 1.51667C10.3446 1.92889 10.9005 2.485 11.3126 3.185C11.7402 3.90833 11.954 4.69389 11.954 5.54167C11.954 6.08611 11.8646 6.61111 11.6858 7.11667C11.507 7.60667 11.2543 8.05389 10.9277 8.45833C10.8733 8.52833 10.7644 8.645 10.6012 8.80833C10.2979 9.12722 10.0841 9.38 9.95974 9.56667C9.73426 9.89333 9.62152 10.2044 9.62152 10.5V11.9583C9.62152 12.1683 9.56904 12.3628 9.46408 12.5417C9.35912 12.7206 9.21722 12.8625 9.0384 12.9675C8.85957 13.0725 8.6652 13.125 8.45527 13.125H6.12277C5.91285 13.125 5.71847 13.0725 5.53965 12.9675C5.36082 12.8625 5.21893 12.7206 5.11397 12.5417C5.009 12.3628 4.95652 12.1683 4.95652 11.9583V10.5C4.95652 10.2044 4.84379 9.89333 4.61831 9.56667C4.49391 9.38 4.2801 9.12722 3.97687 8.80833C3.8136 8.645 3.70475 8.52833 3.65032 8.45833ZM7.87215 5.54167H9.32996L6.7059 9.04167V6.70833H5.24809L7.87215 3.20833V5.54167Z"
                      fill="#F4C430"
                    />
                  </svg>
                </span>
                Pro Tip
              </p>
              <p className="blood-investigations-tip-copy">
                Share this report with your trichologist and request a full
                panel before your consultation. Bring printed results to your
                appointment for a
                <strong> faster, more accurate clinical assessment.</strong>
              </p>
            </article>
          </section>

          {/* Section: Clinical summary */}
          {(clinicalNarrative || resolvedReport?.clinicalSummary || resolvedReport?.clinicalsummary) && (
            <section
              className="clinical-summary-section"
              aria-label="Clinical Summary"
            >
              <article className="clinical-summary-card">
                <header className="clinical-summary-head">
                  <span className="clinical-summary-chip">Clinical Summary</span>
                </header>

                <div className="clinical-summary-list">
                  {clinicalSummaryLines.map((line, idx) => (
                    <p key={`clinical-summary-line-${idx}`} className="clinical-summary-item">
                      {renderClinicalSummaryWithHighlights(line)}
                    </p>
                  ))}
                </div>
              </article>
            </section>
          )}

          {/* Section: Begin Your Recovery Journey */}
          <section
            className="recovery-journey-section"
            aria-label="Begin Your Recovery Journey"
          >
            <article className="recovery-journey-card">
              <header className="recovery-journey-header">
                <h3>Begin Your Recovery Journey</h3>
                <p>
                  Expert trichologists available for personalised consultation
                </p>
              </header>

              <div className="recovery-journey-actions-grid">
                <button
                  type="button"
                  className="recovery-journey-action-btn recovery-journey-action-btn-primary"
                >
                  <span
                    className="recovery-journey-action-icon"
                    aria-hidden="true"
                  >
                    <svg
                      width="19"
                      height="18"
                      viewBox="0 0 19 18"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M13.125 6.9L17.04 4.17C17.12 4.11 17.2125 4.0875 17.3175 4.1025C17.4225 4.1175 17.5 4.17 17.55 4.26C17.6 4.32 17.625 4.39 17.625 4.47V13.53C17.625 13.63 17.5875 13.7175 17.5125 13.7925C17.4375 13.8675 17.35 13.905 17.25 13.905C17.17 13.905 17.1 13.88 17.04 13.83L13.125 11.1V14.25C13.125 14.46 13.0525 14.6375 12.9075 14.7825C12.7625 14.9275 12.585 15 12.375 15H1.875C1.665 15 1.4875 14.9275 1.3425 14.7825C1.1975 14.6375 1.125 14.46 1.125 14.25V3.75C1.125 3.54 1.1975 3.3625 1.3425 3.2175C1.4875 3.0725 1.665 3 1.875 3H12.375C12.585 3 12.7625 3.0725 12.9075 3.2175C13.0525 3.3625 13.125 3.54 13.125 3.75V6.9ZM13.125 9.27L16.125 11.37V6.63L13.125 8.73V9.27ZM2.625 4.5V13.5H11.625V4.5H2.625ZM4.125 6H5.625V7.5H4.125V6Z"
                        fill="#041126"
                      />
                    </svg>
                  </span>
                  Book Video Consultation
                </button>

                <button
                  type="button"
                  className="recovery-journey-action-btn"
                  disabled={withPhotoAnalysis}
                  aria-disabled={withPhotoAnalysis}
                >
                  <span
                    className="recovery-journey-action-icon"
                    aria-hidden="true"
                  >
                    <svg
                      width="19"
                      height="18"
                      viewBox="0 0 19 18"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M5.85 15.615L1.875 16.5L2.76 12.525C2.17 11.435 1.875 10.26 1.875 9C1.875 7.98 2.07 7.005 2.46 6.075C2.84 5.185 3.3775 4.3925 4.0725 3.6975C4.7675 3.0025 5.56 2.465 6.45 2.085C7.38 1.695 8.355 1.5 9.375 1.5C10.395 1.5 11.37 1.695 12.3 2.085C13.19 2.465 13.9825 3.0025 14.6775 3.6975C15.3725 4.3925 15.91 5.185 16.29 6.075C16.68 7.005 16.875 7.98 16.875 9C16.875 10.02 16.68 10.995 16.29 11.925C15.91 12.815 15.3725 13.6075 14.6775 14.3025C13.9825 14.9975 13.19 15.535 12.3 15.915C11.37 16.305 10.395 16.5 9.375 16.5C8.115 16.5 6.94 16.205 5.85 15.615ZM6.06 14.04L6.555 14.295C7.435 14.765 8.375 15 9.375 15C10.465 15 11.475 14.725 12.405 14.175C13.305 13.645 14.02 12.93 14.55 12.03C15.1 11.1 15.375 10.09 15.375 9C15.375 7.91 15.1 6.9 14.55 5.97C14.02 5.07 13.305 4.355 12.405 3.825C11.475 3.275 10.465 3 9.375 3C8.285 3 7.275 3.275 6.345 3.825C5.445 4.355 4.73 5.07 4.2 5.97C3.65 6.9 3.375 7.91 3.375 9C3.375 10 3.61 10.94 4.08 11.82L4.335 12.315L3.855 14.52L6.06 14.04Z"
                        fill="#00E5FF"
                      />
                    </svg>
                  </span>
                  Talk to Hair Expert (Chat)
                </button>

                <button type="button" className="recovery-journey-action-btn">
                  <span
                    className="recovery-journey-action-icon"
                    aria-hidden="true"
                  >
                    <svg
                      width="19"
                      height="18"
                      viewBox="0 0 19 18"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M7.74 3.75L6.24 5.25H3.375V14.25H15.375V5.25H12.51L11.01 3.75H7.74ZM7.125 2.25H11.625L13.125 3.75H16.125C16.335 3.75 16.5125 3.8225 16.6575 3.9675C16.8025 4.1125 16.875 4.29 16.875 4.5V15C16.875 15.21 16.8025 15.3875 16.6575 15.5325C16.5125 15.6775 16.335 15.75 16.125 15.75H2.625C2.415 15.75 2.2375 15.6775 2.0925 15.5325C1.9475 15.3875 1.875 15.21 1.875 15V4.5C1.875 4.29 1.9475 4.1125 2.0925 3.9675C2.2375 3.8225 2.415 3.75 2.625 3.75H5.625L7.125 2.25ZM9.375 13.5C8.625 13.5 7.935 13.315 7.305 12.945C6.675 12.575 6.175 12.075 5.805 11.445C5.435 10.815 5.25 10.125 5.25 9.375C5.25 8.625 5.435 7.935 5.805 7.305C6.175 6.675 6.675 6.175 7.305 5.805C7.935 5.435 8.625 5.25 9.375 5.25C10.125 5.25 10.815 5.435 11.445 5.805C12.075 6.175 12.575 6.675 12.945 7.305C13.315 7.935 13.5 8.625 13.5 9.375C13.5 10.125 13.315 10.815 12.945 11.445C12.575 12.075 12.075 12.575 11.445 12.945C10.815 13.315 10.125 13.5 9.375 13.5ZM9.375 12C9.855 12 10.295 11.8825 10.695 11.6475C11.095 11.4125 11.4125 11.095 11.6475 10.695C11.8825 10.295 12 9.855 12 9.375C12 8.895 11.8825 8.455 11.6475 8.055C11.4125 7.655 11.095 7.3375 10.695 7.1025C10.295 6.8675 9.855 6.75 9.375 6.75C8.895 6.75 8.455 6.8675 8.055 7.1025C7.655 7.3375 7.3375 7.655 7.1025 8.055C6.8675 8.455 6.75 8.895 6.75 9.375C6.75 9.855 6.8675 10.295 7.1025 10.695C7.3375 11.095 7.655 11.4125 8.055 11.6475C8.455 11.8825 8.895 12 9.375 12Z"
                        fill="#00E5FF"
                      />
                    </svg>
                  </span>
                  Upload Scalp Photos for AI Analysis
                </button>

                <button type="button" className="recovery-journey-action-btn">
                  <span
                    className="recovery-journey-action-icon"
                    aria-hidden="true"
                  >
                    <svg
                      width="19"
                      height="18"
                      viewBox="0 0 19 18"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M7.875 4.5C7.875 5.04 7.74 5.54 7.47 6L9.375 7.935L14.415 2.895C14.615 2.705 14.8425 2.575 15.0975 2.505C15.3525 2.435 15.61 2.435 15.87 2.505C16.13 2.575 16.355 2.705 16.545 2.895L7.455 11.97C7.735 12.44 7.875 12.9475 7.875 13.4925C7.875 14.0375 7.74 14.54 7.47 15C7.2 15.46 6.835 15.825 6.375 16.095C5.915 16.365 5.415 16.5 4.875 16.5C4.335 16.5 3.835 16.365 3.375 16.095C2.915 15.825 2.55 15.46 2.28 15C2.01 14.54 1.875 14.04 1.875 13.5C1.875 12.96 2.01 12.46 2.28 12C2.55 11.54 2.915 11.175 3.375 10.905C3.835 10.635 4.3375 10.5 4.8825 10.5C5.4275 10.5 5.935 10.64 6.405 10.92L8.31 9L6.405 7.08C5.935 7.36 5.4275 7.5 4.8825 7.5C4.3375 7.5 3.835 7.365 3.375 7.095C2.915 6.825 2.55 6.46 2.28 6C2.01 5.54 1.875 5.04 1.875 4.5C1.875 3.96 2.01 3.46 2.28 3C2.55 2.54 2.915 2.175 3.375 1.905C3.835 1.635 4.335 1.5 4.875 1.5C5.415 1.5 5.915 1.635 6.375 1.905C6.835 2.175 7.2 2.54 7.47 3C7.74 3.46 7.875 3.96 7.875 4.5ZM6.375 4.5C6.375 4.23 6.3075 3.98 6.1725 3.75C6.0375 3.52 5.855 3.3375 5.625 3.2025C5.395 3.0675 5.145 3 4.875 3C4.605 3 4.355 3.0675 4.125 3.2025C3.895 3.3375 3.7125 3.52 3.5775 3.75C3.4425 3.98 3.375 4.23 3.375 4.5C3.375 4.77 3.4425 5.02 3.5775 5.25C3.7125 5.48 3.895 5.6625 4.125 5.7975C4.355 5.9325 4.605 6 4.875 6C5.145 6 5.395 5.9325 5.625 5.7975C5.855 5.6625 6.0375 5.48 6.1725 5.25C6.3075 5.02 6.375 4.77 6.375 4.5ZM16.545 15.105C16.355 15.295 16.13 15.425 15.87 15.495C15.61 15.565 15.3525 15.565 15.0975 15.495C14.8425 15.425 14.615 15.295 14.415 15.105L10.44 11.115L11.49 10.065L16.545 15.105ZM12.375 8.25H13.875V9.75H12.375V8.25ZM15.375 8.25H16.875V9.75H15.375V8.25ZM4.875 8.25H6.375V9.75H4.875V8.25ZM1.875 8.25H3.375V9.75H1.875V8.25ZM4.875 15C5.145 15 5.395 14.9325 5.625 14.7975C5.855 14.6625 6.0375 14.48 6.1725 14.25C6.3075 14.02 6.375 13.77 6.375 13.5C6.375 13.23 6.3075 12.98 6.1725 12.75C6.0375 12.52 5.855 12.3375 5.625 12.2025C5.395 12.0675 5.145 12 4.875 12C4.605 12 4.355 12.0675 4.125 12.2025C3.895 12.3375 3.7125 12.52 3.5775 12.75C3.4425 12.98 3.375 13.23 3.375 13.5C3.375 13.77 3.4425 14.02 3.5775 14.25C3.7125 14.48 3.895 14.6625 4.125 14.7975C4.355 14.9325 4.605 15 4.875 15Z"
                        fill="#00E5FF"
                      />
                    </svg>
                  </span>
                  Get Hair Transplant Quote (FUE)
                </button>
              </div>

              <button type="button" className="recovery-journey-download-btn" onClick={handleDownloadPdf} disabled={isDownloading}>
                <span
                  className="recovery-journey-action-icon"
                  aria-hidden="true"
                >
                  <svg
                    width="19"
                    height="18"
                    viewBox="0 0 19 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10.125 9H12.375L9.375 12L6.375 9H8.625V6H10.125V9ZM11.625 3H4.125V15H14.625V6H11.625V3ZM2.625 2.25C2.625 2.04 2.6975 1.8625 2.8425 1.7175C2.9875 1.5725 3.165 1.5 3.375 1.5H12.375L16.125 5.25V15.75C16.125 15.95 16.0525 16.125 15.9075 16.275C15.7625 16.425 15.585 16.5 15.375 16.5H3.375C3.165 16.5 2.9875 16.4275 2.8425 16.2825C2.6975 16.1375 2.625 15.96 2.625 15.75V2.25Z"
                      fill="#E6F1FF"
                    />
                  </svg>
                </span>
                {isDownloading ? 'Downloading PDF...' : 'Download Full PDF Report'}
              </button>

              <button type="button" className="recovery-journey-retake-btn" onClick={handleRetakeDiagnostic}>
                <span
                  className="recovery-journey-action-icon"
                  aria-hidden="true"
                >
                  <svg
                    width="17"
                    height="16"
                    viewBox="0 0 17 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3.97075 2.95935C4.56594 2.44379 5.23219 2.04379 5.9695 1.75935C6.72459 1.47491 7.51076 1.33268 8.32803 1.33268C9.23413 1.33268 10.1003 1.50602 10.9264 1.85268C11.717 2.19046 12.421 2.66824 13.0384 3.28602C13.6558 3.90379 14.1333 4.60824 14.4709 5.39935C14.8173 6.22602 14.9905 7.09268 14.9905 7.99935C14.9905 8.70157 14.8839 9.38157 14.6707 10.0393C14.4664 10.6793 14.1688 11.2749 13.778 11.826L11.6593 7.99935H13.658C13.658 7.03046 13.4137 6.13268 12.9252 5.30602C12.4543 4.50602 11.8192 3.87046 11.0197 3.39935C10.1935 2.91046 9.29631 2.66602 8.32803 2.66602C7.62624 2.66602 6.95111 2.79935 6.30263 3.06602C5.68079 3.32379 5.12559 3.68379 4.637 4.14602L3.97075 2.95935ZM12.6853 13.0393C12.0901 13.5549 11.4239 13.9549 10.6866 14.2393C9.93147 14.5238 9.14529 14.666 8.32803 14.666C7.42193 14.666 6.5558 14.4927 5.72965 14.146C4.93904 13.8082 4.23503 13.3305 3.61764 12.7127C3.00025 12.0949 2.52277 11.3905 2.1852 10.5993C1.83875 9.77268 1.66553 8.90602 1.66553 7.99935C1.66553 7.29713 1.77213 6.61713 1.98533 5.95935C2.18964 5.31935 2.48724 4.72379 2.8781 4.17268L4.99678 7.99935H2.99803C2.99803 8.96824 3.24232 9.86602 3.7309 10.6927C4.20172 11.4927 4.83688 12.1282 5.63638 12.5993C6.46253 13.0882 7.35974 13.3327 8.32803 13.3327C9.02981 13.3327 9.70494 13.1993 10.3534 12.9327C10.9753 12.6749 11.5305 12.3149 12.0191 11.8527L12.6853 13.0393Z"
                      fill="#9FB4D0"
                    />
                  </svg>
                </span>
                Retake Diagnostic
              </button>
            </article>
          </section>

          {/* Share Your Results Section */}
          <section className="share-results-section container">
            <div className="share-header">
              <div className="share-icon-main">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#00E5FF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </div>
              <h2>Share Your Results</h2>
              <p>
                Know someone with hair concerns? Share your assessment or refer{" "}
                <br /> them to TrichoScan AI for their own free assessment.
              </p>
            </div>

            <div className="share-actions-grid">
              <button className="share-btn btn-amber">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="black"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h6v6" />
                  <path d="M10 14L21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
                <span>Share My Results</span>
              </button>
              <button className="share-btn btn-green">
                <svg
                  width="19"
                  height="18"
                  viewBox="0 0 19 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.82 13.875L6.36 14.19C7.29 14.73 8.2975 15 9.3825 15C10.4675 15 11.475 14.725 12.405 14.175C13.305 13.645 14.02 12.93 14.55 12.03C15.1 11.1 15.375 10.09 15.375 9C15.375 7.91 15.1 6.9 14.55 5.97C14.02 5.07 13.305 4.355 12.405 3.825C11.475 3.275 10.465 3 9.375 3C8.285 3 7.275 3.275 6.345 3.825C5.445 4.355 4.73 5.07 4.2 5.97C3.65 6.9 3.375 7.9075 3.375 8.9925C3.375 10.0775 3.645 11.085 4.185 12.015L4.5 12.555L4.02 14.355L5.82 13.875ZM1.875 16.5L2.895 12.78C2.565 12.21 2.3125 11.6075 2.1375 10.9725C1.9625 10.3375 1.875 9.68 1.875 9C1.875 7.98 2.07 7.005 2.46 6.075C2.84 5.185 3.3775 4.3925 4.0725 3.6975C4.7675 3.0025 5.56 2.465 6.45 2.085C7.38 1.695 8.355 1.5 9.375 1.5C10.395 1.5 11.37 1.695 12.3 2.085C13.19 2.465 13.9825 3.0025 14.6775 3.6975C15.3725 4.3925 15.91 5.185 16.29 6.075C16.68 7.005 16.875 7.98 16.875 9C16.875 10.02 16.68 10.995 16.29 11.925C15.91 12.815 15.3725 13.6075 14.6775 14.3025C13.9825 14.9975 13.19 15.535 12.3 15.915C11.37 16.305 10.395 16.5 9.375 16.5C8.695 16.5 8.0375 16.4125 7.4025 16.2375C6.7675 16.0625 6.165 15.81 5.595 15.48L1.875 16.5ZM6.675 5.475C6.775 5.475 6.875 5.475 6.975 5.475L7.095 5.49C7.155 5.5 7.2125 5.5225 7.2675 5.5575C7.3225 5.5925 7.36 5.63 7.38 5.67C7.61 6.18 7.83 6.69 8.04 7.2C8.09 7.32 8.065 7.455 7.965 7.605C7.915 7.695 7.85 7.79 7.77 7.89L7.5 8.19L7.47 8.25C7.45 8.3 7.445 8.345 7.455 8.385C7.465 8.425 7.49 8.48 7.53 8.55L7.575 8.625C7.775 8.955 8.03 9.27 8.34 9.57L8.61 9.825C8.97 10.145 9.365 10.395 9.795 10.575L9.99 10.665C10.04 10.685 10.085 10.7 10.125 10.71L10.185 10.725C10.265 10.725 10.34 10.69 10.41 10.62C10.79 10.15 10.985 9.915 10.995 9.915C11.065 9.845 11.16 9.815 11.28 9.825C11.33 9.825 11.375 9.835 11.415 9.855L12.9 10.515C12.94 10.535 12.975 10.5625 13.005 10.5975C13.035 10.6325 13.05 10.67 13.05 10.71V10.725C13.05 10.815 13.045 10.905 13.035 10.995C13.005 11.225 12.96 11.41 12.9 11.55C12.86 11.63 12.805 11.705 12.735 11.775C12.665 11.845 12.585 11.915 12.495 11.985L12.405 12.06C12.315 12.11 12.215 12.165 12.105 12.225C11.915 12.325 11.71 12.38 11.49 12.39H11.43C11.27 12.4 11.15 12.405 11.07 12.405L10.635 12.33C9.555 12.05 8.595 11.54 7.755 10.8C7.665 10.72 7.53 10.59 7.35 10.41L7.275 10.335C6.615 9.675 6.125 8.99 5.805 8.28C5.635 7.91 5.55 7.555 5.55 7.215C5.55 6.745 5.69 6.325 5.97 5.955L6 5.925C6.06 5.845 6.115 5.78 6.165 5.73C6.255 5.64 6.33 5.58 6.39 5.55C6.47 5.51 6.565 5.485 6.675 5.475Z"
                    fill="white"
                  />
                </svg>

                <span>Share on WhatsApp</span>
              </button>
            </div>

            <div className="referral-card">
              <div className="referral-icon-box">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0 12C0 5.37258 5.37258 0 12 0H28C34.6274 0 40 5.37258 40 12V28C40 34.6274 34.6274 40 28 40H12C5.37258 40 0 34.6274 0 28V12Z"
                    fill="#00E5FF"
                    fillOpacity="0.1"
                  />
                  <path
                    d="M20.3672 22.07V23.63C19.8872 23.46 19.3872 23.375 18.8672 23.375C18.0572 23.375 17.3022 23.58 16.6022 23.99C15.9222 24.39 15.3822 24.93 14.9822 25.61C14.5722 26.31 14.3672 27.065 14.3672 27.875H12.8672C12.8672 26.785 13.1422 25.775 13.6922 24.845C14.2222 23.945 14.9372 23.23 15.8372 22.7C16.7672 22.15 17.7772 21.875 18.8672 21.875C19.3772 21.875 19.8772 21.94 20.3672 22.07ZM18.8672 21.125C18.0472 21.125 17.2922 20.92 16.6022 20.51C15.9222 20.11 15.3822 19.57 14.9822 18.89C14.5722 18.2 14.3672 17.445 14.3672 16.625C14.3672 15.805 14.5722 15.05 14.9822 14.36C15.3822 13.68 15.9222 13.14 16.6022 12.74C17.2922 12.33 18.0472 12.125 18.8672 12.125C19.6872 12.125 20.4422 12.33 21.1322 12.74C21.8122 13.14 22.3522 13.68 22.7522 14.36C23.1622 15.05 23.3672 15.805 23.3672 16.625C23.3672 17.445 23.1622 18.2 22.7522 18.89C22.3522 19.57 21.8122 20.11 21.1322 20.51C20.4422 20.92 19.6872 21.125 18.8672 21.125ZM18.8672 19.625C19.4072 19.625 19.9072 19.49 20.3672 19.22C20.8272 18.95 21.1922 18.585 21.4622 18.125C21.7322 17.665 21.8672 17.165 21.8672 16.625C21.8672 16.085 21.7322 15.585 21.4622 15.125C21.1922 14.665 20.8272 14.3 20.3672 14.03C19.9072 13.76 19.4072 13.625 18.8672 13.625C18.3272 13.625 17.8272 13.76 17.3672 14.03C16.9072 14.3 16.5422 14.665 16.2722 15.125C16.0022 15.585 15.8672 16.085 15.8672 16.625C15.8672 17.165 16.0022 17.665 16.2722 18.125C16.5422 18.585 16.9072 18.95 17.3672 19.22C17.8272 19.49 18.3272 19.625 18.8672 19.625ZM23.3672 24.125V21.875H24.8672V24.125H27.1172V25.625H24.8672V27.875H23.3672V25.625H21.1172V24.125H23.3672Z"
                    fill="#00E5FF"
                  />
                </svg>
              </div>
              <div className="referral-content">
                <div className="referral-text-stack">
                  <h3>Refer a Friend</h3>
                  <p>
                    Share TrichoScan AI with someone experiencing hair loss.
                    Their free assessment takes only 2 minutes.
                  </p>
                </div>
                <button
                  className="copy-referral-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      "Join TrichoScan AI for a free hair intelligence assessment: https://trichoscan-ai.com",
                    );
                    toast.success("Referral link copied!");
                  }}
                >
                  Copy Referral Summary
                </button>
              </div>
            </div>

            <p className="share-disclaimer">
              Only your assessment summary text is shared — no personal health
              data or photos are ever transmitted during sharing.
            </p>
          </section>

          {/* AI Photo Analysis Not Performed Section */}
          {!withPhotoAnalysis && (
            <section className="photo-analysis-not-performed-section container">
              <div className="photo-analysis-icon-wrapper">
                <svg
                  width="32"
                  height="30"
                  viewBox="0 0 32 30"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3.125 8.125C3.125 7.775 3.24583 7.47917 3.4875 7.2375C3.72917 6.99583 4.025 6.875 4.375 6.875H26.875C27.225 6.875 27.5208 6.99583 27.7625 7.2375C28.0042 7.47917 28.125 7.775 28.125 8.125V25.625C28.125 25.975 28.0042 26.2708 27.7625 26.5125C27.5208 26.7542 27.225 26.875 26.875 26.875H4.375C4.025 26.875 3.72917 26.7542 3.4875 26.5125C3.24583 26.2708 3.125 25.975 3.125 25.625V8.125ZM5.625 9.375V24.375H25.625V9.375H5.625ZM18.125 20.625C18.8083 20.625 19.4375 20.4583 20.0125 20.125C20.5875 19.7917 21.0417 19.3375 21.375 18.7625C21.7083 18.1875 21.875 17.5583 21.875 16.875C21.875 16.1917 21.7083 15.5625 21.375 14.9875C21.0417 14.4125 20.5875 13.9583 20.0125 13.625C19.4375 13.2917 18.8083 13.125 18.125 13.125C17.4417 13.125 16.8125 13.2917 16.2375 13.625C15.6625 13.9583 15.2083 14.4125 14.875 14.9875C14.5417 15.5625 14.375 16.1917 14.375 16.875C14.375 17.5583 14.5417 18.1875 14.875 18.7625C15.2083 19.3375 15.6625 19.7917 16.2375 20.125C16.8125 20.4583 17.4417 20.625 18.125 20.625ZM18.125 23.125C16.9917 23.125 15.9458 22.8458 14.9875 22.2875C14.0292 21.7292 13.2708 20.9708 12.7125 20.0125C12.1542 19.0542 11.875 18.0083 11.875 16.875C11.875 15.7417 12.1542 14.6958 12.7125 13.7375C13.2708 12.7792 14.0292 12.0208 14.9875 11.4625C15.9458 10.9042 16.9917 10.625 18.125 10.625C19.2583 10.625 20.3042 10.9042 21.2625 11.4625C22.2208 12.0208 22.9792 12.7792 23.5375 13.7375C24.0958 14.6958 24.375 15.7417 24.375 16.875C24.375 18.0083 24.0958 19.0542 23.5375 20.0125C22.9792 20.9708 22.2208 21.7292 21.2625 22.2875C20.3042 22.8458 19.2583 23.125 18.125 23.125ZM5.625 3.125H13.125V5.625H5.625V3.125Z"
                    fill="#00E5FF"
                  />
                </svg>
              </div>

              <div className="photo-analysis-badge">REPORT 2 — NOT PERFORMED</div>

              <h2 className="photo-analysis-title">
                AI Photo Analysis Not Performed
              </h2>

              <p className="photo-analysis-description">
                You skipped the photo analysis step. Upload scalp photos to
                receive a visual AI assessment that cross-validates your
                questionnaire results for{" "}
                <span className="accuracy-highlight">+34% accuracy</span>.
              </p>

              <div className="accuracy-comparison-box">
                <div className="accuracy-row">
                  <span className="accuracy-label">Current Accuracy</span>
                  <span className="accuracy-label">With Photo Analysis</span>
                </div>
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{ width: "66%" }}
                    ></div>
                  </div>
                </div>
                <div className="accuracy-percentages">
                  <span className="current-percentage">66%</span>
                  <span className="target-percentage">100%</span>
                </div>
              </div>

              <button type="button" className="add-photo-analysis-btn" onClick={handleGoToPhotoUpload}>
                <svg
                  width="15"
                  height="14"
                  viewBox="0 0 15 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.865 1.5L4.365 3H1.5V12H13.5V3H10.635L9.135 1.5H5.865ZM5.25 0H9.75L11.25 1.5H14.25C14.46 1.5 14.6375 1.5725 14.7825 1.7175C14.9275 1.8625 15 2.04 15 2.25V12.75C15 12.96 14.9275 13.1375 14.7825 13.2825C14.6375 13.4275 14.46 13.5 14.25 13.5H0.75C0.54 13.5 0.3625 13.4275 0.2175 13.2825C0.0725 13.1375 0 12.96 0 12.75V2.25C0 2.04 0.0725 1.8625 0.2175 1.7175C0.3625 1.5725 0.54 1.5 0.75 1.5H3.75L5.25 0ZM7.5 11.25C6.75 11.25 6.06 11.065 5.43 10.695C4.8 10.325 4.3 9.825 3.93 9.195C3.56 8.565 3.375 7.875 3.375 7.125C3.375 6.375 3.56 5.685 3.93 5.055C4.3 4.425 4.8 3.925 5.43 3.555C6.06 3.185 6.75 3 7.5 3C8.25 3 8.94 3.185 9.57 3.555C10.2 3.925 10.7 4.425 11.07 5.055C11.44 5.685 11.625 6.375 11.625 7.125C11.625 7.875 11.44 8.565 11.07 9.195C10.7 9.825 10.2 10.325 9.57 10.695C8.94 11.065 8.25 11.25 7.5 11.25ZM7.5 9.75C7.98 9.75 8.42 9.6325 8.82 9.3975C9.22 9.1625 9.5375 8.845 9.7725 8.445C10.0075 8.045 10.125 7.605 10.125 7.125C10.125 6.645 10.0075 6.205 9.7725 5.805C9.5375 5.405 9.22 5.0875 8.82 4.8525C8.42 4.6175 7.98 4.5 7.5 4.5C7.02 4.5 6.58 4.6175 6.18 4.8525C5.78 5.0875 5.4625 5.405 5.2275 5.805C4.9925 6.205 4.875 6.645 4.875 7.125C4.875 7.605 4.9925 8.045 5.2275 8.445C5.4625 8.845 5.78 9.1625 6.18 9.3975C6.58 9.6325 7.02 9.75 7.5 9.75Z"
                    fill="#041126"
                  />
                </svg>
                Add Photo Analysis Now
                <svg
                  width="19"
                  height="18"
                  viewBox="0 0 19 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12.51 8.24996L8.475 4.22996L9.54 3.16496L15.375 8.99996L9.54 14.835L8.475 13.77L12.51 9.74996H3.375V8.24996H12.51Z"
                    fill="#041126"
                  />
                </svg>
              </button>

              <p className="photo-analysis-footer-text">
                Takes less than 2 minutes · No account required
              </p>
            </section>
          )}
        </div>
        {/* Section: recommendation sidebar */}
        {(recommendationRows.length > 0 || freebiesRows.length > 0) && (
          <aside className="aside-container">
            {recommendationRows.length > 0 && (
              <div className="recommendation-panel">
                <h3>
                  <span className="sidebar-title-icon" aria-hidden="true">
                    <svg
                      width="15"
                      height="14"
                      viewBox="0 0 15 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M11.4992 5.61167L11.3476 5.95001C11.3165 6.02778 11.264 6.08028 11.1902 6.1075C11.1163 6.13473 11.0425 6.13473 10.9686 6.1075C10.8947 6.08028 10.8422 6.02778 10.8111 5.95001L10.6595 5.61167C10.5351 5.32389 10.3602 5.06528 10.1347 4.83584C9.90925 4.60639 9.65267 4.42945 9.365 4.30501L8.92182 4.10667C8.84407 4.07556 8.79159 4.02112 8.76438 3.94334C8.73717 3.86556 8.73717 3.78778 8.76438 3.71C8.79159 3.63223 8.84407 3.57778 8.92182 3.54667L9.34167 3.36001C9.63712 3.22778 9.89953 3.045 10.1289 2.81167C10.3583 2.57834 10.5351 2.31001 10.6595 2.00667L10.7995 1.64501C10.8384 1.56723 10.8947 1.51278 10.9686 1.48167C11.0425 1.45056 11.1163 1.45056 11.1902 1.48167C11.264 1.51278 11.3204 1.56723 11.3593 1.64501L11.4992 2.00667C11.6236 2.31001 11.8005 2.57834 12.0299 2.81167C12.2592 3.045 12.5216 3.22778 12.8171 3.36001L13.2369 3.54667C13.3147 3.57778 13.3672 3.63223 13.3944 3.71C13.4216 3.78778 13.4216 3.86556 13.3944 3.94334C13.3672 4.02112 13.3147 4.07556 13.2369 4.10667L12.7938 4.30501C12.5061 4.42945 12.2495 4.60639 12.024 4.83584C11.7986 5.06528 11.6236 5.32389 11.4992 5.61167ZM3.49876 3.20834C3.28883 3.20834 3.09446 3.26084 2.91563 3.36584C2.73681 3.47084 2.59492 3.61278 2.48995 3.79167C2.38499 3.97056 2.33251 4.165 2.33251 4.375V10.2083C2.33251 10.4183 2.38499 10.6128 2.48995 10.7917C2.59492 10.9706 2.73681 11.1125 2.91563 11.2175C3.09446 11.3225 3.28883 11.375 3.49876 11.375H10.4963C10.7062 11.375 10.9006 11.3225 11.0794 11.2175C11.2582 11.1125 11.4001 10.9706 11.5051 10.7917C11.61 10.6128 11.6625 10.4183 11.6625 10.2083V7.29167H12.8288V10.2083C12.8288 10.6283 12.7238 11.0172 12.5139 11.375C12.3039 11.7328 12.0202 12.0167 11.6625 12.2267C11.3049 12.4367 10.9161 12.5417 10.4963 12.5417H3.49876C3.07891 12.5417 2.69016 12.4367 2.33251 12.2267C1.97486 12.0167 1.69107 11.7328 1.48115 11.375C1.27122 11.0172 1.16626 10.6283 1.16626 10.2083V4.375C1.16626 3.955 1.27122 3.56612 1.48115 3.20834C1.69107 2.85056 1.97486 2.56667 2.33251 2.35667C2.69016 2.14667 3.07891 2.04167 3.49876 2.04167H7.58063V3.20834H3.49876Z"
                        fill="#00E5FF"
                      />
                    </svg>
                  </span>
                  Recommended for Your Hair Condition
                </h3>
                <p className="side-subtitle">Based on your diagnosis and root causes</p>

                <div className="match-card">
                  <span className="match-icon" aria-hidden="true">
                    <svg
                      width="13"
                      height="12"
                      viewBox="0 0 13 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4.75 2C4.93 2 5.09667 2.045 5.25 2.135C5.40333 2.225 5.525 2.34667 5.615 2.5C5.705 2.65333 5.75 2.82 5.75 3V6.41C5.33 6.09 4.77333 5.87333 4.08 5.76L3.92 6.74C4.56667 6.85333 5.03333 7.065 5.32 7.375C5.60667 7.685 5.75 8.14333 5.75 8.75C5.75 8.97667 5.69333 9.185 5.58 9.375C5.46667 9.565 5.315 9.71667 5.125 9.83C4.935 9.94333 4.72667 10 4.5 10C4.27333 10 4.065 9.94333 3.875 9.83C3.685 9.71667 3.53333 9.565 3.42 9.375C3.30667 9.185 3.25 8.97667 3.25 8.75V8.57C3.47667 8.65 3.7 8.70667 3.92 8.74L4.08 7.76C3.74667 7.7 3.37333 7.57333 2.96 7.38C2.74667 7.28 2.575 7.12833 2.445 6.925C2.315 6.72167 2.25 6.49667 2.25 6.25C2.25 5.85 2.34333 5.52167 2.53 5.265C2.71667 5.00833 2.99667 4.83333 3.37 4.74L3.75 4.64V3C3.75 2.82 3.795 2.65333 3.885 2.5C3.975 2.34667 4.09667 2.225 4.25 2.135C4.40333 2.045 4.57 2 4.75 2ZM6.25 1.68C6.06333 1.46667 5.84 1.3 5.58 1.18C5.32 1.06 5.04333 1 4.75 1C4.39 1 4.05667 1.09 3.75 1.27C3.44333 1.45 3.2 1.69333 3.02 2C2.84 2.30667 2.75 2.64 2.75 3V3.89C2.31667 4.06333 1.97333 4.32333 1.72 4.67C1.40667 5.10333 1.25 5.63 1.25 6.25C1.25 6.63667 1.34 6.99333 1.52 7.32C1.7 7.64667 1.94333 7.91333 2.25 8.12V8.75C2.25 9.15667 2.35167 9.53167 2.555 9.875C2.75833 10.2183 3.03167 10.4917 3.375 10.695C3.71833 10.8983 4.09333 11 4.5 11C4.84667 11 5.17167 10.925 5.475 10.775C5.77833 10.625 6.03667 10.42 6.25 10.16C6.46333 10.42 6.72167 10.625 7.025 10.775C7.32833 10.925 7.65333 11 8 11C8.40667 11 8.78167 10.8983 9.125 10.695C9.46833 10.4917 9.74167 10.2183 9.945 9.875C10.1483 9.53167 10.25 9.15667 10.25 8.75V8.12C10.5567 7.91333 10.8 7.64667 10.98 7.32C11.16 6.99333 11.25 6.63667 11.25 6.25C11.25 5.63 11.0933 5.10333 10.78 4.67C10.5267 4.32333 10.1833 4.06333 9.75 3.89V3C9.75 2.64 9.66 2.30667 9.48 2C9.3 1.69333 9.05667 1.45 8.75 1.27C8.44333 1.09 8.11 1 7.75 1C7.45667 1 7.18 1.06 6.92 1.18C6.66 1.3 6.43667 1.46667 6.25 1.68ZM9.25 8.57V8.75C9.25 8.97667 9.19333 9.185 9.08 9.375C8.96667 9.565 8.815 9.71667 8.625 9.83C8.435 9.94333 8.22667 10 8 10C7.77333 10 7.565 9.94333 7.375 9.83C7.185 9.71667 7.03333 9.565 6.92 9.375C6.80667 9.185 6.75 8.97667 6.75 8.75C6.75 8.14333 6.89333 7.685 7.18 7.375C7.46667 7.065 7.93333 6.85333 8.58 6.74L8.42 5.76C7.72667 5.87333 7.17 6.09 6.75 6.41V3C6.75 2.82 6.795 2.65333 6.885 2.5C6.975 2.34667 7.09667 2.225 7.25 2.135C7.40333 2.045 7.57 2 7.75 2C7.93 2 8.09667 2.045 8.25 2.135C8.40333 2.225 8.525 2.34667 8.615 2.5C8.705 2.65333 8.75 2.82 8.75 3V4.64L9.13 4.74C9.50333 4.83333 9.78333 5.00833 9.97 5.265C10.1567 5.52167 10.25 5.85 10.25 6.25C10.25 6.49667 10.185 6.72167 10.055 6.925C9.925 7.12833 9.75333 7.28 9.54 7.38C9.12667 7.57333 8.75333 7.7 8.42 7.76L8.58 8.74C8.8 8.70667 9.02333 8.65 9.25 8.57Z"
                        fill="#00E5FF"
                      />
                    </svg>
                  </span>
                  <span>
                    AI matched <b>{recommendationRows.length} products</b> to your {asDisplayText(reportData?.hhiStatus, "condition")} profile
                  </span>
                </div>

                <div className="side-product-list">
                  {recommendationRows.map((row, idx) => (
                    <article className="side-product-card" key={idx}>
                      <div
                        className={`product-thumb ${row.thumbClass}`}
                        style={{ backgroundImage: `url(${sharedThumbImage})` }}
                      />
                      <div className="product-copy">
                        <h4>{row.title}</h4>
                        <span className={`product-tag ${row.tagTone}`}>
                          {row.tag}
                        </span>
                        <p>{row.desc}</p>
                        <div className="product-bottom-row">
                          <span className={row.purposeTone}>{row.purpose}</span>
                          <strong>{row.price}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="go-btn"
                        aria-label="View product"
                      >
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M7.90725 6.99999L5.02661 4.11832L5.84299 3.28999L9.55166 6.99999L5.84299 10.71L5.02661 9.88166L7.90725 6.99999Z"
                            fill="#9FB4D0"
                          />
                        </svg>
                      </button>
                    </article>
                  ))}
                </div>

                <div className="cta-card">
                  <div className="cta-icon-wrap">
                    <svg
                      width="21"
                      height="20"
                      viewBox="0 0 21 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16.2459 1.66665V3.33331H14.5796V5.83331C15.0351 5.83331 15.4544 5.94442 15.8377 6.16665C16.2209 6.38887 16.5236 6.69165 16.7458 7.07498C16.9679 7.45831 17.079 7.87776 17.079 8.33331V17.5C17.079 17.7333 16.9985 17.9305 16.8374 18.0916C16.6763 18.2528 16.4792 18.3333 16.2459 18.3333H4.58215C4.34887 18.3333 4.1517 18.2528 3.99063 18.0916C3.82956 17.9305 3.74902 17.7333 3.74902 17.5V8.33331C3.74902 7.87776 3.86011 7.45831 4.08227 7.07498C4.30444 6.69165 4.60714 6.38887 4.99038 6.16665C5.37362 5.94442 5.79296 5.83331 6.2484 5.83331V3.33331H4.58215V1.66665H16.2459ZM14.5796 7.49998H6.2484C6.01512 7.49998 5.81795 7.58054 5.65688 7.74165C5.49581 7.90276 5.41527 8.09998 5.41527 8.33331V16.6666H15.4128V8.33331C15.4128 8.09998 15.3322 7.90276 15.1712 7.74165C15.0101 7.58054 14.8129 7.49998 14.5796 7.49998ZM11.2471 9.16665V10.8333H12.9134V12.5H11.2471V14.1666H9.5809V12.5H7.91465V10.8333H9.5809V9.16665H11.2471ZM12.9134 3.33331H7.91465V5.83331H12.9134V3.33331Z"
                        fill="#F4C430"
                      />
                    </svg>
                  </div>
                  <h4>Get a Personalized Treatment Kit</h4>
                  <p>Our trichologist will curate the exact products for your condition and stage.</p>
                  <button type="button" className="cta-btn">
                    <svg
                      width="13"
                      height="12"
                      viewBox="0 0 13 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8.65999 8.02999L8.74999 8.11999L8.83999 8.02999C8.97999 7.88332 9.14666 7.78499 9.33999 7.73499C9.53332 7.68499 9.72666 7.68499 9.91999 7.73499C10.1133 7.78499 10.2833 7.88332 10.43 8.02999C10.5767 8.17665 10.675 8.34665 10.725 8.53999C10.775 8.73332 10.775 8.92499 10.725 9.11499C10.675 9.30499 10.5767 9.47332 10.43 9.61999L8.74999 11.3L7.06999 9.61999C6.92332 9.47332 6.82499 9.30499 6.77499 9.11499C6.72499 8.92499 6.72499 8.73332 6.77499 8.53999C6.82499 8.34665 6.92332 8.17665 7.06999 8.02999C7.21666 7.88332 7.38666 7.78499 7.57999 7.73499C7.77332 7.68499 7.96666 7.68499 8.15999 7.73499C8.35332 7.78499 8.51999 7.88332 8.65999 8.02999ZM5.73999 7.19999V8.19999C5.19999 8.19999 4.69666 8.33665 4.22999 8.60999C3.77666 8.87665 3.41666 9.23665 3.14999 9.68999C2.87666 10.1567 2.73999 10.66 2.73999 11.2H1.73999C1.73999 10.4867 1.91666 9.82332 2.26999 9.20999C2.60999 8.61665 3.07332 8.14332 3.65999 7.78999C4.25999 7.41665 4.91332 7.21999 5.61999 7.19999H5.73999ZM5.73999 0.699987C6.28666 0.699987 6.79332 0.836654 7.25999 1.10999C7.70666 1.37665 8.06332 1.73665 8.32999 2.18999C8.60332 2.64999 8.73999 3.14999 8.73999 3.68999C8.73999 4.22999 8.60999 4.72665 8.34999 5.17999C8.09666 5.62665 7.74832 5.98665 7.30499 6.25999C6.86166 6.53332 6.37666 6.67999 5.84999 6.69999H5.73999C5.19999 6.69999 4.69666 6.56332 4.22999 6.28999C3.77666 6.02332 3.41666 5.66332 3.14999 5.20999C2.87666 4.74999 2.73999 4.24999 2.73999 3.70999C2.73999 3.16999 2.86999 2.67332 3.12999 2.21999C3.38332 1.77332 3.73166 1.41332 4.17499 1.13999C4.61832 0.866653 5.10332 0.719987 5.62999 0.699987H5.73999ZM5.73999 1.69999C5.37999 1.69999 5.04666 1.78999 4.73999 1.96999C4.43332 2.14999 4.18999 2.39332 4.00999 2.69999C3.82999 3.00665 3.73999 3.33999 3.73999 3.69999C3.73999 4.05999 3.82999 4.39332 4.00999 4.69999C4.18999 5.00665 4.43332 5.24999 4.73999 5.42999C5.04666 5.60999 5.37999 5.69999 5.73999 5.69999C6.09999 5.69999 6.43332 5.60999 6.73999 5.42999C7.04666 5.24999 7.28999 5.00665 7.46999 4.69999C7.64999 4.39332 7.73999 4.05999 7.73999 3.69999C7.73999 3.33999 7.64999 3.00665 7.46999 2.69999C7.28999 2.39332 7.04666 2.14999 6.73999 1.96999C6.43332 1.78999 6.09999 1.69999 5.73999 1.69999Z"
                        fill="#020617"
                      />
                    </svg>
                    Talk to Expert
                  </button>
                </div>
              </div>
            )}

            {freebiesRows.length > 0 && (
              <article
                className="freebies-card"
                aria-label="Freebies with your order"
              >
                <div className="freebies-list">
                  {freebiesRows.map((freebie) => (
                    <article className="freebies-item" key={freebie.title}>
                      <div
                        className="freebies-thumb"
                        style={{ backgroundImage: `url(${sharedThumbImage})` }}
                      />
                      <div className="freebies-copy">
                        <h4>{freebie.title}</h4>
                        <p>{freebie.desc}</p>
                      </div>
                      <span className="freebies-check" aria-hidden="true">
                        <svg
                          width="15"
                          height="14"
                          viewBox="0 0 15 14"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M7.28901 12.8334C6.49596 12.8334 5.7379 12.6817 5.01483 12.3784C4.32285 12.0828 3.70668 11.6648 3.16632 11.1242C2.62596 10.5837 2.20805 9.96726 1.9126 9.27504C1.60938 8.55171 1.45776 7.79337 1.45776 7.00004C1.45776 6.20671 1.60938 5.44837 1.9126 4.72504C2.20805 4.03282 2.62596 3.41643 3.16632 2.87587C3.70668 2.33532 4.32285 1.91726 5.01483 1.62171C5.7379 1.31837 6.49596 1.16671 7.28901 1.16671C8.08206 1.16671 8.84013 1.31837 9.5632 1.62171C10.2552 1.91726 10.8713 2.33532 11.4117 2.87587C11.9521 3.41643 12.37 4.03282 12.6654 4.72504C12.9687 5.44837 13.1203 6.20671 13.1203 7.00004C13.1203 7.79337 12.9687 8.55171 12.6654 9.27504C12.37 9.96726 11.9521 10.5837 11.4117 11.1242C10.8713 11.6648 10.2552 12.0828 9.5632 12.3784C8.84013 12.6817 8.08206 12.8334 7.28901 12.8334ZM6.70589 9.33337L10.8344 5.20337L10.0064 4.38671L6.70589 7.68837L5.06148 6.03171L4.23344 6.86004L6.70589 9.33337Z"
                            fill="#10B981"
                          />
                        </svg>
                      </span>
                    </article>
                  ))}
                </div>

                <div className="freebies-unlock-strip">
                  <svg
                    width="13"
                    height="12"
                    viewBox="0 0 13 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7.5 2.22C7.72 2.22 7.92333 2.165 8.11 2.055C8.29667 1.945 8.445 1.79667 8.555 1.61C8.665 1.42333 8.72 1.22 8.72 1H9.28C9.28 1.22 9.335 1.42333 9.445 1.61C9.555 1.79667 9.70333 1.945 9.89 2.055C10.0767 2.165 10.28 2.22 10.5 2.22V2.78C10.28 2.78 10.0767 2.835 9.89 2.945C9.70333 3.055 9.555 3.20333 9.445 3.39C9.335 3.57667 9.28 3.78 9.28 4H8.72C8.72 3.78 8.665 3.57667 8.555 3.39C8.445 3.20333 8.29667 3.055 8.11 2.945C7.92333 2.835 7.72 2.78 7.5 2.78V2.22ZM1 5.5C1.54 5.5 2.04333 5.36333 2.51 5.09C2.96333 4.82333 3.32333 4.46333 3.59 4.01C3.86333 3.54333 4 3.04 4 2.5H5C5 3.04 5.13667 3.54333 5.41 4.01C5.67667 4.46333 6.03667 4.82333 6.49 5.09C6.95667 5.36333 7.46 5.5 8 5.5V6.5C7.46 6.5 6.95667 6.63667 6.49 6.91C6.03667 7.17667 5.67667 7.53667 5.41 7.99C5.13667 8.45667 5 8.96 5 9.5H4C4 8.96 3.86333 8.45667 3.59 7.99C3.32333 7.53667 2.96333 7.17667 2.51 6.91C2.04333 6.63667 1.54 6.5 1 6.5V5.5ZM2.94 6C3.26667 6.18 3.56333 6.40333 3.83 6.67C4.09667 6.93667 4.32 7.23333 4.5 7.56C4.68 7.23333 4.90333 6.93667 5.17 6.67C5.43667 6.40333 5.73333 6.18 6.06 6C5.73333 5.82 5.43667 5.59667 5.17 5.33C4.90333 5.06333 4.68 4.76667 4.5 4.44C4.32 4.76667 4.09667 5.06333 3.83 5.33C3.56333 5.59667 3.26667 5.82 2.94 6ZM9.13 7C9.13 7.29333 9.05667 7.565 8.91 7.815C8.76333 8.065 8.565 8.26333 8.315 8.41C8.065 8.55667 7.79333 8.62667 7.5 8.62V9.37C7.79333 9.37 8.065 9.44333 8.315 9.59C8.565 9.73667 8.76167 9.935 8.905 10.185C9.04833 10.435 9.12 10.7067 9.12 11H9.88C9.87333 10.7067 9.94333 10.435 10.09 10.185C10.2367 9.935 10.435 9.73667 10.685 9.59C10.935 9.44333 11.2067 9.37 11.5 9.37V8.62C11.2067 8.62 10.935 8.54833 10.685 8.405C10.435 8.26167 10.2367 8.065 10.09 7.815C9.94333 7.565 9.87333 7.29333 9.88 7H9.13Z"
                      fill="#F4C430"
                    />
                  </svg>
                  <span>
                    <b>5 freebies unlocked</b>
                    <em> - add your kit to claim them</em>
                  </span>
                </div>

                <button type="button" className="freebies-cta-btn">
                  <svg
                    width="13"
                    height="12"
                    viewBox="0 0 13 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6.25 5.5V4L8.25 6L6.25 8V6.5H4.25V5.5H6.25ZM6.25 1C6.93 1 7.58 1.13 8.2 1.39C8.79333 1.64333 9.32167 2.00167 9.785 2.465C10.2483 2.92833 10.6067 3.45667 10.86 4.05C11.12 4.67 11.25 5.32 11.25 6C11.25 6.68 11.12 7.33 10.86 7.95C10.6067 8.54333 10.2483 9.07167 9.785 9.535C9.32167 9.99833 8.79333 10.3567 8.2 10.61C7.58 10.87 6.93 11 6.25 11C5.57 11 4.92 10.87 4.3 10.61C3.70667 10.3567 3.17833 9.99833 2.715 9.535C2.25167 9.07167 1.89333 8.54333 1.64 7.95C1.38 7.33 1.25 6.68 1.25 6C1.25 5.32 1.38 4.67 1.64 4.05C1.89333 3.45667 2.25167 2.92833 2.715 2.465C3.17833 2.00167 3.70667 1.64333 4.3 1.39C4.92 1.13 5.57 1 6.25 1ZM6.25 10C6.97667 10 7.65 9.81667 8.27 9.45C8.87 9.09667 9.34667 8.62 9.7 8.02C10.0667 7.4 10.25 6.72667 10.25 6C10.25 5.27333 10.0667 4.6 9.7 3.98C9.34667 3.38 8.87 2.90333 8.27 2.55C7.65 2.18333 6.97667 2 6.25 2C5.52333 2 4.85 2.18333 4.23 2.55C3.63 2.90333 3.15333 3.38 2.8 3.98C2.43333 4.6 2.25 5.27333 2.25 6C2.25 6.72667 2.43333 7.4 2.8 8.02C3.15333 8.62 3.63 9.09667 4.23 9.45C4.85 9.81667 5.52333 10 6.25 10Z"
                      fill="#020617"
                    />
                  </svg>
                  Proceed with Recommended Kit
                </button>
              </article>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Section */}
      <div className="bottom-report-section">
        {/* Legal & Regulatory Notice */}
        <section className="legal-notice-section container">
          <div className="legal-notice-header">
            <div className="legal-icon-wrap">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 20h10" />
                <path d="M10 20v-4" />
                <path d="M14 20v-4" />
                <path d="M15 7v5" />
                <path d="M9 7v5" />
                <path d="M6 7l6-4 6 4" />
                <path d="M4 14.5l3-1.5 3 1.5-3 1.5-3-1.5z" />
                <path d="M14 14.5l3-1.5 3 1.5-3 1.5-3-1.5z" />
              </svg>
            </div>
            <h3>Important Legal & Regulatory Notice</h3>
          </div>

          <div className="legal-notice-grid">
            <article className="legal-card">
              <div className="legal-card-head">
                <div className="legal-card-icon icon-red">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M0 12C0 5.37258 5.37258 0 12 0H16C22.6274 0 28 5.37258 28 12V16C28 22.6274 22.6274 28 16 28H12C5.37258 28 0 22.6274 0 16V12Z"
                      fill="#EF4444"
                      fillOpacity="0.07"
                    />
                    <path
                      d="M12 0.5H16C22.3513 0.5 27.5 5.64873 27.5 12V16C27.5 22.3513 22.3513 27.5 16 27.5H12C5.64873 27.5 0.5 22.3513 0.5 16V12C0.5 5.64873 5.64873 0.5 12 0.5Z"
                      stroke="#EF4444"
                      strokeOpacity="0.157"
                    />
                    <path
                      d="M15.5 10H10.5V18H17.5V12H15.5V10ZM9.5 9.5C9.5 9.36 9.54833 9.24167 9.645 9.145C9.74167 9.04833 9.86 9 10 9H16L18.5 11.5V18.5C18.5 18.6333 18.4517 18.75 18.355 18.85C18.2583 18.95 18.14 19 18 19H10C9.86 19 9.74167 18.9517 9.645 18.855C9.54833 18.7583 9.5 18.64 9.5 18.5V9.5ZM13.5 15.5H14.5V16.5H13.5V15.5ZM13.5 11.5H14.5V14.5H13.5V11.5Z"
                      fill="#EF4444"
                    />
                  </svg>
                </div>
                <h4 className="medical-diagnosis-title">
                  Not a Medical Diagnosis-3916
                </h4>
              </div>
              <p className="legal-card-body">
                This report is a health information assessment generated by
                AI. It is NOT a clinical diagnosis and does not constitute
                medical advice. The term "Provisional Assessment" indicates an
                AI-generated impression only.
              </p>
            </article>

            <article className="legal-card">
              <div className="legal-card-head">
                <div className="legal-card-icon icon-yellow">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M0 12C0 5.37258 5.37258 0 12 0H16C22.6274 0 28 5.37258 28 12V16C28 22.6274 22.6274 28 16 28H12C5.37258 28 0 22.6274 0 16V12Z"
                      fill="#F4C430"
                      fillOpacity="0.07"
                    />
                    <path
                      d="M12 0.5H16C22.3513 0.5 27.5 5.64873 27.5 12V16C27.5 22.3513 22.3513 27.5 16 27.5H12C5.64873 27.5 0.5 22.3513 0.5 16V12C0.5 5.64873 5.64873 0.5 12 0.5Z"
                      stroke="#F4C430"
                      strokeOpacity="0.157"
                    />
                    <g clipPath="url(#clip0_335_5457)">
                      <path
                        d="M16.4102 16.0308L16.5002 16.1208L16.5902 16.0308C16.7302 15.8841 16.8969 15.7858 17.0902 15.7358C17.2836 15.6858 17.4769 15.6858 17.6702 15.7358C17.8636 15.7858 18.0336 15.8841 18.1802 16.0308C18.3269 16.1774 18.4252 16.3474 18.4752 16.5408C18.5252 16.7341 18.5252 16.9258 18.4752 17.1158C18.4252 17.3058 18.3269 17.4741 18.1802 17.6208L16.5002 19.3008L14.8202 17.6208C14.6736 17.4741 14.5752 17.3058 14.5252 17.1158C14.4752 16.9258 14.4752 16.7341 14.5252 16.5408C14.5752 16.3474 14.6736 16.1774 14.8202 16.0308C14.9669 15.8841 15.1369 15.7858 15.3302 15.7358C15.5236 15.6858 15.7169 15.6858 15.9102 15.7358C16.1036 15.7858 16.2702 15.8841 16.4102 16.0308ZM13.4902 15.2008V16.2008C12.9502 16.2008 12.4469 16.3374 11.9802 16.6108C11.5269 16.8774 11.1669 17.2374 10.9002 17.6908C10.6269 18.1574 10.4902 18.6608 10.4902 19.2008H9.49023C9.49023 18.4874 9.6669 17.8241 10.0202 17.2108C10.3602 16.6174 10.8236 16.1441 11.4102 15.7908C12.0102 15.4174 12.6636 15.2208 13.3702 15.2008H13.4902ZM13.4902 8.70078C14.0369 8.70078 14.5436 8.83745 15.0102 9.11078C15.4569 9.37745 15.8136 9.73745 16.0802 10.1908C16.3536 10.6508 16.4902 11.1508 16.4902 11.6908C16.4902 12.2308 16.3602 12.7274 16.1002 13.1808C15.8469 13.6274 15.4986 13.9874 15.0552 14.2608C14.6119 14.5341 14.1269 14.6808 13.6002 14.7008H13.4902C12.9502 14.7008 12.4469 14.5641 11.9802 14.2908C11.5269 14.0241 11.1669 13.6641 10.9002 13.2108C10.6269 12.7508 10.4902 12.2508 10.4902 11.7108C10.4902 11.1708 10.6202 10.6741 10.8802 10.2208C11.1336 9.77411 11.4819 9.41411 11.9252 9.14078C12.3686 8.86745 12.8536 8.72078 13.3802 8.70078H13.4902ZM13.4902 9.70078C13.1302 9.70078 12.7969 9.79078 12.4902 9.97078C12.1836 10.1508 11.9402 10.3941 11.7602 10.7008C11.5802 11.0074 11.4902 11.3408 11.4902 11.7008C11.4902 12.0608 11.5802 12.3941 11.7602 12.7008C11.9402 13.0074 12.1836 13.2508 12.4902 13.4308C12.7969 13.6108 13.1302 13.7008 13.4902 13.7008C13.8502 13.7008 14.1836 13.6108 14.4902 13.4308C14.7969 13.2508 15.0402 13.0074 15.2202 12.7008C15.4002 12.3941 15.4902 12.0608 15.4902 11.7008C15.4902 11.3408 15.4002 11.0074 15.2202 10.7008C15.0402 10.3941 14.7969 10.1508 14.4902 9.97078C14.1836 9.79078 13.8502 9.70078 13.4902 9.70078Z"
                        fill="#F4C430"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_335_5457">
                        <rect
                          width="12.5"
                          height="12"
                          fill="white"
                          transform="translate(7.75 8)"
                        />
                      </clipPath>
                    </defs>
                  </svg>
                </div>
                <h4>Consult a Professional</h4>
              </div>
              <p className="legal-card-body">
                Always seek the advice of a qualified dermatologist or
                trichologist. Never disregard or delay professional medical
                consultation based on information from this tool.
              </p>
            </article>

            <article className="legal-card">
              <div className="legal-card-head">
                <div className="legal-card-icon icon-cyan">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M0 12C0 5.37258 5.37258 0 12 0H16C22.6274 0 28 5.37258 28 12V16C28 22.6274 22.6274 28 16 28H12C5.37258 28 0 22.6274 0 16V12Z"
                      fill="#00E5FF"
                      fillOpacity="0.07"
                    />
                    <path
                      d="M12 0.5H16C22.3513 0.5 27.5 5.64873 27.5 12V16C27.5 22.3513 22.3513 27.5 16 27.5H12C5.64873 27.5 0.5 22.3513 0.5 16V12C0.5 5.64873 5.64873 0.5 12 0.5Z"
                      stroke="#00E5FF"
                      strokeOpacity="0.157"
                    />
                    <g clipPath="url(#clip0_335_5469)">
                      <path
                        d="M14 8.5L18.11 9.41C18.2233 9.43667 18.3167 9.49667 18.39 9.59C18.4633 9.68333 18.5 9.78667 18.5 9.9V14.89C18.5 15.3967 18.3817 15.87 18.145 16.31C17.9083 16.75 17.58 17.11 17.16 17.39L14 19.5L10.84 17.39C10.42 17.11 10.0917 16.75 9.855 16.31C9.61833 15.87 9.5 15.3967 9.5 14.89V9.9C9.5 9.78667 9.53667 9.68333 9.61 9.59C9.68333 9.49667 9.77667 9.43667 9.89 9.41L14 8.5ZM14 9.52L10.5 10.3V14.89C10.5 15.23 10.5783 15.5467 10.735 15.84C10.8917 16.1333 11.11 16.3733 11.39 16.56L14 18.3L16.61 16.56C16.89 16.3733 17.1083 16.1333 17.265 15.84C17.4217 15.5467 17.5 15.23 17.5 14.89V10.3L14 9.52ZM16.23 12.11L16.93 12.82L13.75 16L11.63 13.88L12.34 13.17L13.75 14.59L16.23 12.11Z"
                        fill="#00E5FF"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_335_5469">
                        <rect
                          width="12.5"
                          height="12"
                          fill="white"
                          transform="translate(7.75 8)"
                        />
                      </clipPath>
                    </defs>
                  </svg>
                </div>
                <h4>DPDP Act 2023 Compliance</h4>
              </div>
              <p className="legal-card-body">
                Your health data is processed under the Digital Personal Data
                Protection Act, 2023 (India). Scalp photos (if uploaded) are
                processed in-memory only and are not retained on any server.
              </p>
            </article>

            <article className="legal-card">
              <div className="legal-card-head">
                <div className="legal-card-icon icon-purple">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M0 12C0 5.37258 5.37258 0 12 0H16C22.6274 0 28 5.37258 28 12V16C28 22.6274 22.6274 28 16 28H12C5.37258 28 0 22.6274 0 16V12Z"
                      fill="#A78BFA"
                      fillOpacity="0.07"
                    />
                    <path
                      d="M12 0.5H16C22.3513 0.5 27.5 5.64873 27.5 12V16C27.5 22.3513 22.3513 27.5 16 27.5H12C5.64873 27.5 0.5 22.3513 0.5 16V12C0.5 5.64873 5.64873 0.5 12 0.5Z"
                      stroke="#A78BFA"
                      strokeOpacity="0.157"
                    />
                    <g clipPath="url(#clip0_335_5480)">
                      <path
                        d="M14.75 9.62063C14.75 9.73396 14.7283 9.83896 14.685 9.93563C14.6417 10.0323 14.58 10.114 14.5 10.1806V11.1206H17C17.2733 11.1206 17.525 11.189 17.755 11.3256C17.985 11.4623 18.1667 11.6456 18.3 11.8756C18.4333 12.1056 18.5 12.354 18.5 12.6206V17.6206C18.5 17.894 18.4333 18.1456 18.3 18.3756C18.1667 18.6056 17.985 18.789 17.755 18.9256C17.525 19.0623 17.2733 19.1273 17 19.1206H11C10.7267 19.1273 10.475 19.0623 10.245 18.9256C10.015 18.789 9.83333 18.6056 9.7 18.3756C9.56667 18.1456 9.5 17.894 9.5 17.6206V12.6206C9.5 12.354 9.56667 12.1056 9.7 11.8756C9.83333 11.6456 10.015 11.4623 10.245 11.3256C10.475 11.189 10.7267 11.1206 11 11.1206H13.5V10.1806C13.42 10.114 13.3583 10.0323 13.315 9.93563C13.2717 9.83896 13.25 9.7373 13.25 9.63063C13.25 9.4173 13.3233 9.2373 13.47 9.09063C13.6167 8.94396 13.7933 8.8723 14 8.87563C14.2067 8.87896 14.3833 8.9523 14.53 9.09563C14.6767 9.23896 14.75 9.4173 14.75 9.63063V9.62063ZM11 12.1206C10.86 12.1206 10.7417 12.1706 10.645 12.2706C10.5483 12.3706 10.5 12.4873 10.5 12.6206V17.6206C10.5 17.7606 10.5483 17.879 10.645 17.9756C10.7417 18.0723 10.86 18.1206 11 18.1206H17C17.14 18.1206 17.2583 18.0723 17.355 17.9756C17.4517 17.879 17.5 17.7606 17.5 17.6206V12.6206C17.5 12.4873 17.4517 12.3723 17.355 12.2756C17.2583 12.179 17.14 12.1273 17 12.1206H11ZM9 13.6206H8V16.6206H9V13.6206ZM19 13.6206H20V16.6206H19V13.6206ZM12.5 15.8706C12.7067 15.8773 12.8833 15.8073 13.03 15.6606C13.1767 15.514 13.25 15.3356 13.25 15.1256C13.25 14.9156 13.1767 14.7373 13.03 14.5906C12.8833 14.444 12.7067 14.3723 12.5 14.3756C12.2933 14.379 12.1167 14.4523 11.97 14.5956C11.8233 14.739 11.75 14.9156 11.75 15.1256C11.75 15.3356 11.8233 15.5123 11.97 15.6556C12.1167 15.799 12.2933 15.8706 12.5 15.8706ZM15.5 15.8706C15.7067 15.8706 15.8833 15.799 16.03 15.6556C16.1767 15.5123 16.25 15.3356 16.25 15.1256C16.25 14.9156 16.1767 14.7373 16.03 14.5906C15.8833 14.444 15.7067 14.3723 15.5 14.3756C15.2933 14.379 15.1167 14.4523 14.97 14.5956C14.8233 14.739 14.75 14.9156 14.75 15.1256C14.75 15.3356 14.8233 15.5123 14.97 15.6556C15.1167 15.799 15.2933 15.8706 15.5 15.8706Z"
                        fill="#A78BFA"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_335_5480">
                        <rect
                          width="12.5"
                          height="12"
                          fill="white"
                          transform="translate(7.75 8)"
                        />
                      </clipPath>
                    </defs>
                  </svg>
                </div>
                <h4>Third-Party AI Processing</h4>
              </div>
              <p className="legal-card-body">
                Assessment outputs are generated by Anthropic Claude AI (a
                US-based service). By using this tool you acknowledge consent
                to this processing on the entry screen.
              </p>
            </article>
          </div>
        </section>

        {/* Footer */}
        <footer className="report-footer container">
          <div className="footer-links">
            <a href="#" className="footer-link">
              Privacy Policy
            </a>
            <span className="footer-separator">|</span>
            <a href="#" className="footer-link">
              Terms of Service
            </a>
            <span className="footer-separator">|</span>
            <a href="#" className="footer-link">
              Data Processing Agreement
            </a>
          </div>
          <div className="footer-copyright">© TrichoScan AI 2025-3969</div>
        </footer>
        </div>
      </section>
    </>
  );
}

