import { Navigate, useNavigate, useParams } from 'react-router-dom';
import DealDetailView from '../components/CRM/DealDetailView';

const DealViewPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return <Navigate to="/clients?tab=deals" replace />;
  }

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }
    navigate('/clients?tab=deals');
  };

  const handleEdit = (dealId: string) => {
    navigate('/clients?tab=deals', { state: { editDealId: dealId } });
  };

  return (
    <DealDetailView
      dealId={id}
      onBack={handleBack}
      onEdit={handleEdit}
    />
  );
};

export default DealViewPage;
