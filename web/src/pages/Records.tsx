import { NavLink, Navigate, useParams } from 'react-router-dom'
import { PageTitle } from '../components/Layout'
import { cx } from '../components/ui'
import { Allergies } from './records/Allergies'
import { Conditions } from './records/Conditions'
import { Medications } from './records/Medications'
import { Reports } from './records/Reports'

const tabs = [
  { key: 'allergies', label: 'Allergies', el: <Allergies /> },
  { key: 'medicines', label: 'Medicines', el: <Medications /> },
  { key: 'conditions', label: 'Conditions', el: <Conditions /> },
  { key: 'reports', label: 'Reports', el: <Reports /> },
]

export function Records() {
  const { tab } = useParams()
  const current = tabs.find((t) => t.key === tab)
  if (!current) return <Navigate to="/records/allergies" replace />
  return (
    <>
      <PageTitle title="My records" />
      <nav aria-label="Record sections" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <NavLink key={t.key} to={`/records/${t.key}`} replace
            className={({ isActive }) => cx('h-10 shrink-0 rounded-full border px-4 leading-[38px] text-sm font-semibold', isActive ? 'border-ink bg-ink text-white' : 'border-line-2 bg-surface text-ink-2 hover:border-ink-3')}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div key={current.key}>{current.el}</div>
    </>
  )
}
