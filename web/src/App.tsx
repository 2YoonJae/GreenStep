import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
import Support from './pages/Support';
import Verify from './pages/Verify';
import Login from './pages/Login';
import Signup from './pages/Signup';
import MyPage from './pages/youth/MyPage';
import Records from './pages/youth/Records';
import RecordNew from './pages/youth/RecordNew';
import Resume from './pages/youth/Resume';
import Dashboard from './pages/org/Dashboard';
import OrgActivities from './pages/org/OrgActivities';
import ActivityForm from './pages/org/ActivityForm';
import Reports from './pages/org/Reports';

function NotFound() {
  return (
    <div className="container section">
      <div className="empty-state">
        <h3 className="text-xl font-bold">페이지를 찾을 수 없습니다</h3>
        <p>주소를 다시 확인해 주세요.</p>
        <Link className="button" to="/">홈으로</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        {/* 공개 */}
        <Route path="/" element={<Home />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/activities/:id" element={<ActivityDetail />} />
        <Route path="/support" element={<Support />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/login" element={<Login type="youth" />} />
        <Route path="/org/login" element={<Login type="org" />} />
        <Route path="/signup" element={<Signup type="youth" />} />
        <Route path="/org/signup" element={<Signup type="org" />} />
        {/* 청년 전용 */}
        <Route path="/me" element={<MyPage />} />
        <Route path="/me/records" element={<Records />} />
        <Route path="/me/records/new" element={<RecordNew />} />
        <Route path="/me/resume" element={<Resume />} />
        {/* 기관 전용 */}
        <Route path="/org" element={<Dashboard />} />
        <Route path="/org/activities" element={<OrgActivities />} />
        <Route path="/org/activities/new" element={<ActivityForm />} />
        <Route path="/org/activities/:id/edit" element={<ActivityForm />} />
        <Route path="/org/reports" element={<Reports />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
