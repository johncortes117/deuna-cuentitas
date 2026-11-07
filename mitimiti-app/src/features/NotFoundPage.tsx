import { useNavigate } from 'react-router'
import { Button } from '../ui/Button'
import { ErrorScreen } from '../ui/Layout'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <ErrorScreen
      title="No encontramos esta página"
      body="Puede que el link esté incompleto. Si te lo mandaron por WhatsApp, pídele a tu amigo que lo envíe otra vez."
      action={<Button full onClick={() => navigate('/')}>Ir al inicio</Button>}
    />
  )
}
