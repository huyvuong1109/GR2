import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, ArrowLeft, Search } from 'lucide-react'
import { Button } from '../components/ui'

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4"
    >
      {/* 404 Text */}
      <div className="relative mb-8">
        <h1 className="text-[150px] md:text-[200px] font-bold font-display leading-none text-dark-800">
          404
        </h1>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 bg-gradient-to-br from-primary-500/20 to-accent-500/20 rounded-full blur-3xl" />
        </div>
      </div>

      {/* Message */}
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
        Không tìm thấy trang
      </h2>
      <p className="text-dark-400 max-w-md mb-8">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển. 
        Hãy kiểm tra lại URL hoặc quay về trang chủ.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link to="/">
          <Button variant="primary" leftIcon={<Home className="w-4 h-4" />}>
            Về trang chủ
          </Button>
        </Link>
        <Link to="/screener">
          <Button variant="secondary" leftIcon={<Search className="w-4 h-4" />}>
            Sàng lọc cổ phiếu
          </Button>
        </Link>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent-500/5 rounded-full blur-3xl pointer-events-none" />
    </motion.div>
  )
}
