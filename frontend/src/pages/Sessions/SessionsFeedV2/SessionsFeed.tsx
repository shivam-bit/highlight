import SessionFeedConfiguration from '@pages/Sessions/SessionsFeedV2/components/SessionFeedConfiguration/SessionFeedConfiguration';
import { SessionFeedConfigurationContextProvider } from '@pages/Sessions/SessionsFeedV2/context/SessionFeedConfigurationContext';
import { useSessionFeedConfiguration } from '@pages/Sessions/SessionsFeedV2/hooks/useSessionFeedConfiguration';
import { useIntegrated } from '@util/integrated';
import { isOnPrem } from '@util/onPrem/onPremUtils';
import { useParams } from '@util/react-router/useParams';
import { message } from 'antd';
import React, { RefObject, useEffect, useMemo, useState } from 'react';
import useInfiniteScroll from 'react-infinite-scroll-hook';
import Skeleton from 'react-loading-skeleton';
import TextTransition from 'react-text-transition';

import { SearchEmptyState } from '../../../components/SearchEmptyState/SearchEmptyState';
import Switch from '../../../components/Switch/Switch';
import LimitedSessionCard from '../../../components/Upsell/LimitedSessionsCard/LimitedSessionsCard';
import {
    useGetBillingDetailsQuery,
    useGetSessionsQuery,
    useUnprocessedSessionsCountQuery,
} from '../../../graph/generated/hooks';
import { PlanType, SessionLifecycle } from '../../../graph/generated/schemas';
import { formatNumber } from '../../../util/numbers';
import usePlayerConfiguration from '../../Player/PlayerHook/utils/usePlayerConfiguration';
import { useReplayerContext } from '../../Player/ReplayerContext';
import { useSearchContext } from '../SearchContext/SearchContext';
import { LIVE_SEGMENT_ID } from '../SearchSidebar/SegmentPicker/SegmentPicker';
import MinimalSessionCard from './components/MinimalSessionCard/MinimalSessionCard';
import styles from './SessionsFeed.module.scss';

// const SESSIONS_FEED_POLL_INTERVAL = 1000 * 10;

export const SessionFeed = React.memo(() => {
    const { setSessionResults, sessionResults } = useReplayerContext();
    const { project_id, segment_id, session_secure_id } = useParams<{
        project_id: string;
        segment_id: string;
        session_secure_id: string;
    }>();
    const sessionFeedConfiguration = useSessionFeedConfiguration();
    const [count, setCount] = useState(10);
    const {
        autoPlaySessions,
        setAutoPlaySessions,
        setShowDetailedSessionView,
        showDetailedSessionView,
    } = usePlayerConfiguration();
    const { integrated } = useIntegrated();

    // Used to determine if we need to show the loading skeleton. The loading skeleton should only be shown on the first load and when searchParams changes. It should not show when loading more sessions via infinite scroll.
    const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(true);
    const {
        searchParams,
        showStarredSessions,
        setSearchParams,
    } = useSearchContext();
    const { show_live_sessions } = searchParams;
    const { data: billingDetails } = useGetBillingDetailsQuery({
        variables: { project_id },
    });
    const { data: unprocessedSessionsCount } = useUnprocessedSessionsCountQuery(
        {
            variables: {
                project_id,
            },
            pollInterval: 5000,
        }
    );

    const { loading, fetchMore, called } = useGetSessionsQuery({
        variables: {
            params: searchParams,
            count: count + 10,
            project_id,
            lifecycle:
                segment_id === LIVE_SEGMENT_ID
                    ? SessionLifecycle.All
                    : show_live_sessions
                    ? SessionLifecycle.All
                    : SessionLifecycle.Completed,
            starred: showStarredSessions,
        },
        // pollInterval: SESSIONS_FEED_POLL_INTERVAL,
        onCompleted: (response) => {
            if (response?.sessions) {
                setSessionResults(response.sessions);
            }
            setShowLoadingSkeleton(false);
        },
    });

    useEffect(() => {
        setShowLoadingSkeleton(true);
    }, [searchParams]);

    useEffect(() => {
        // We're showing live sessions for new users.
        // The assumption here is if a project is on the free plan and the project has less than 15 sessions than there must be live sessions.
        // We show live sessions along with the processed sessions so the user isn't confused on why sessions are not showing up in the feed.
        if (billingDetails?.billingDetails && integrated) {
            if (
                billingDetails.billingDetails.plan.type === PlanType.Free &&
                billingDetails.billingDetails.meter < 15
            ) {
                setSearchParams({ ...searchParams, show_live_sessions: true });
            }
        }
    }, [
        billingDetails?.billingDetails,
        integrated,
        searchParams,
        setSearchParams,
    ]);

    const infiniteRef = useInfiniteScroll({
        checkInterval: 1200, // frequency to check (1.2s)
        loading,
        hasNextPage: sessionResults.sessions.length < sessionResults.totalCount,
        scrollContainer: 'parent',
        onLoadMore: () => {
            setCount((previousCount) => previousCount + 10);
            fetchMore({
                variables: {
                    params: searchParams,
                    count,
                    project_id,
                    processed:
                        segment_id === LIVE_SEGMENT_ID
                            ? SessionLifecycle.Live
                            : searchParams.show_live_sessions
                            ? SessionLifecycle.Live
                            : SessionLifecycle.Completed,
                },
            });
        },
    });

    const filteredSessions = useMemo(() => {
        if (loading) {
            return sessionResults.sessions;
        }
        if (searchParams.hide_viewed) {
            return sessionResults.sessions.filter(
                (session) => !session?.viewed
            );
        }
        return sessionResults.sessions;
    }, [loading, searchParams.hide_viewed, sessionResults.sessions]);

    return (
        <SessionFeedConfigurationContextProvider
            value={sessionFeedConfiguration}
        >
            <div className={styles.fixedContent}>
                <div className={styles.resultCount}>
                    {sessionResults.totalCount === -1 ? (
                        <Skeleton width="100px" />
                    ) : (
                        sessionResults.totalCount > 0 && (
                            <div className={styles.resultCountValueContainer}>
                                <span className={styles.countContainer}>
                                    <TextTransition
                                        inline
                                        text={`${formatNumber(
                                            sessionResults.totalCount
                                        )}`}
                                    />{' '}
                                    {`sessions `}
                                    {unprocessedSessionsCount?.unprocessedSessionsCount >
                                        0 &&
                                        !searchParams.show_live_sessions && (
                                            <button
                                                className={
                                                    styles.liveSessionsCountButton
                                                }
                                                onClick={() => {
                                                    message.success(
                                                        'Showing live sessions'
                                                    );
                                                    setSearchParams({
                                                        ...searchParams,
                                                        show_live_sessions: !searchParams.show_live_sessions,
                                                    });
                                                }}
                                            >
                                                (
                                                {formatNumber(
                                                    unprocessedSessionsCount?.unprocessedSessionsCount
                                                )}{' '}
                                                live)
                                            </button>
                                        )}
                                </span>
                                <div className={styles.sessionFeedActions}>
                                    <Switch
                                        label="Autoplay"
                                        checked={autoPlaySessions}
                                        onChange={(checked) => {
                                            setAutoPlaySessions(checked);
                                        }}
                                        trackingId="SessionFeedAutoplay"
                                    />
                                    <Switch
                                        label="Details"
                                        checked={showDetailedSessionView}
                                        onChange={(checked) => {
                                            setShowDetailedSessionView(checked);
                                        }}
                                        trackingId="SessionFeedShowDetails"
                                    />
                                    {showDetailedSessionView && (
                                        <SessionFeedConfiguration
                                            configuration={
                                                sessionFeedConfiguration
                                            }
                                        />
                                    )}
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
            <div className={styles.feedContent}>
                <div ref={infiniteRef as RefObject<HTMLDivElement>}>
                    {loading && showLoadingSkeleton ? (
                        <Skeleton
                            height={74}
                            count={3}
                            style={{
                                borderRadius: 8,
                                marginBottom: 14,
                            }}
                        />
                    ) : (
                        <>
                            {!sessionResults.sessions.length &&
                            called &&
                            !loading ? (
                                <SearchEmptyState item={'sessions'} newFeed />
                            ) : (
                                <>
                                    {!isOnPrem && <LimitedSessionCard />}
                                    {filteredSessions.map((u) => (
                                        <MinimalSessionCard
                                            session={u}
                                            key={u?.secure_id}
                                            selected={
                                                session_secure_id ===
                                                u?.secure_id
                                            }
                                            autoPlaySessions={autoPlaySessions}
                                            showDetailedSessionView={
                                                showDetailedSessionView
                                            }
                                            configuration={
                                                sessionFeedConfiguration
                                            }
                                        />
                                    ))}
                                </>
                            )}
                            {sessionResults.sessions.length <
                                sessionResults.totalCount && (
                                <Skeleton
                                    height={74}
                                    style={{
                                        borderRadius: 8,
                                        marginBottom: 24,
                                    }}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </SessionFeedConfigurationContextProvider>
    );
});
