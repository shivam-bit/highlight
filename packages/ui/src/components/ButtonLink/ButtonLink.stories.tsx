import React from 'react'
import { ComponentMeta } from '@storybook/react'

import { ButtonLink } from './ButtonLink'

export default {
	title: 'Components/ButtonLink',
	component: ButtonLink,
} as ComponentMeta<typeof ButtonLink>

export const Basic = () => (
	<>
		<ButtonLink
			onClick={() =>
				alert('Use buttons for actions and links to navigate!')
			}
		>
			I am a button that looks like a link!
		</ButtonLink>
	</>
)
