import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/login/LoginPage";
import AuthCallback from "@/pages/login/AuthCallback";
import OnboardingPage from "@/pages/onboarding/OnboardingPage";
import HomePage from "@/pages/home/HomePage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import MeetingLauncher from "@/pages/meeting/MeetingLauncher";
import ContributionDashboard from "@/pages/meeting/ContributionDashboard";

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/dashboard/*" element={<DashboardPage />} />
        {/* 실시간 회의 플로우 (수직 슬라이스) */}
        <Route path="/meetings" element={<MeetingLauncher />} />
        <Route
          path="/meetings/:meetingId/report"
          element={<ContributionDashboard />}
        />
        {/* 정의되지 않은 경로는 로그인으로 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* useToast 훅이 DOM을 직접 조작하는 대상. React 상태 대신 DOM 조작 방식으로
          어느 컴포넌트에서든 호출 가능하고 리렌더 없이 즉시 표시됨. */}
      <div className="toast" id="toast">
        <i className="ti ti-circle-check" />
        <span />
      </div>
    </div>
  );
}
