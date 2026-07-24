import { useI18n } from '../../../../i18n/context'
import { Group } from '../../../common/Group'
import { Row } from '../../../common/Row'
import { Button } from '../../../common/Button'
import { IconGitBranch, IconTrash } from '../../../../design-system/icons'
import { RepoAdder } from './repo-adder'
import type { Repo } from './types'

interface RepoRowProps {
  repo: Repo
  onRemove: () => void
}

function RepoRow({ repo, onRemove }: RepoRowProps) {
  const { t } = useI18n()

  return (
    <Row
      icon={<IconGitBranch size={18} />}
      controls={
        <Button variant="ghost" size="sm" icon title={t('githost.repos.remove')} onClick={onRemove}>
          <IconTrash size={13} />
        </Button>
      }
    >
      <span className="gh-publish-repo">{repo.owner}/{repo.repo}</span>
    </Row>
  )
}

interface RepoListSectionProps {
  title: string
  repos: Repo[]
  onRemove: (repo: Repo) => void
  onAdd: (repo: Repo) => Promise<void>
}

export function RepoListSection({ title, repos, onRemove, onAdd }: RepoListSectionProps) {
  return (
    <Group title={title}>
      {repos.map((repo) => (
        <RepoRow
          key={`${repo.owner}/${repo.repo}`}
          repo={repo}
          onRemove={() => onRemove(repo)}
        />
      ))}
      <RepoAdder onAdd={onAdd} />
    </Group>
  )
}
