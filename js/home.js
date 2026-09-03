// ==========================================
// IGA HOMEPAGE
// ==========================================


// ==========================================
// LOAD HOMEPAGE
// ==========================================

async function loadHomePage() {

    console.log(
        "Loading IGA Homepage..."
    );

    try {

        // ------------------------------------------
        // GET CURRENT SEASON
        // ------------------------------------------

        const {
            data: seasons,
            error: seasonError
        } = await supabaseClient

            .from("seasons")

            .select(`
                id,
                season_name,
                start_date,
                end_date
            `)

            .order(
                "start_date",
                {
                    ascending: false
                }
            );


        if (seasonError) {

            throw seasonError;

        }


        if (
            !seasons ||
            seasons.length === 0
        ) {

            throw new Error(
                "No IGA seasons found."
            );

        }


        // ------------------------------------------
        // FIND CURRENT SEASON
        // ------------------------------------------

        const today =
            new Date();


        let currentSeason =
            seasons.find(
                season => {

                    const start =
                        new Date(
                            season.start_date
                        );

                    const end =
                        new Date(
                            season.end_date
                        );

                    return (
                        today >= start &&
                        today <= end
                    );

                }
            );


        // ------------------------------------------
        // FALLBACK TO MOST RECENT SEASON
        // ------------------------------------------

        if (!currentSeason) {

            currentSeason =
                seasons[0];

        }


        console.log(
            "Homepage current season:",
            currentSeason
        );


        // ------------------------------------------
        // DISPLAY SEASON
        // ------------------------------------------

        const seasonElement =
            document.getElementById(
                "currentSeasonName"
            );


        if (seasonElement) {

            seasonElement.textContent =
                currentSeason.season_name;

        }


        // ------------------------------------------
        // LOAD HOMEPAGE SECTIONS
        // ------------------------------------------

        await loadCurrentLeader(
            currentSeason.id
        );


        await loadOpenRounds(
            currentSeason.id
        );


        await loadRecentRounds(
            currentSeason.id
        );


        await loadLeagueRecords(
            currentSeason.id
        );


        console.log(
            "IGA Homepage loaded successfully."
        );


    } catch (error) {

        console.error(
            "IGA HOMEPAGE ERROR:",
            error
        );

    }

}



// ==========================================
// CURRENT IGA LEADER
// ==========================================

async function loadCurrentLeader(
    seasonId
) {

    const container =
        document.getElementById(
            "currentLeader"
        );


    if (!container) {

        return;

    }


    try {

        // ==========================================
        // GET REGULAR SEASON EVENTS
        // ==========================================

        const {
            data: events,
            error: eventError
        } = await supabaseClient

            .from("events_table")

            .select(`
                id,
                event_name,
                status,
                event_type,
                season_id
            `)

            .eq(
                "season_id",
                seasonId
            )

            .eq(
                "event_type",
                "Regular Season"
            )

            .order(
                "id",
                {
                    ascending: true
                }
            );


        if (eventError) {

            throw eventError;

        }


        if (
            !events ||
            events.length === 0
        ) {

            container.innerHTML = `
                <div class="home-empty">
                    No regular season events available yet.
                </div>
            `;

            return;

        }


        // ==========================================
        // CHECK IF REGULAR SEASON IS FINALIZED
        // ==========================================

        const regularSeasonFinalized =
            events.every(
                event =>
                    event.status ===
                    "Finalized"
            );


        // ==========================================
        // BUILD LIVE SEASON STANDINGS
        // ==========================================

        const playerStandings = {};


        for (
            const event
            of events
        ) {

            // ------------------------------------------
            // GET CURRENT EVENT STANDINGS
            // ------------------------------------------

            const standings =
                await getEventStandings(
                    event.id
                );


            // ------------------------------------------
            // ADD EVENT POINTS TO PLAYER TOTAL
            // ------------------------------------------

            standings.forEach(
                round => {

                    const playerId =
                        round.player_id;


                    if (
                        !playerStandings[
                            playerId
                        ]
                    ) {

                        playerStandings[
                            playerId
                        ] = {

                            player_id:
                                playerId,

                            name:
                                round.Players?.Name ||
                                "Unknown Player",

                            points:
                                0,

                            rounds:
                                0

                        };

                    }


                    playerStandings[
                        playerId
                    ].points +=
                        Number(
                            round.provisional_points
                        ) || 0;


                    playerStandings[
                        playerId
                    ].rounds += 1;

                }
            );

        }


        // ==========================================
        // CONVERT TO ARRAY AND SORT
        // ==========================================

        const standingsArray =
            Object.values(
                playerStandings
            )
            .sort(
                (a, b) => {

                    if (
                        b.points !==
                        a.points
                    ) {

                        return (
                            b.points -
                            a.points
                        );

                    }

                    return (
                        a.name.localeCompare(
                            b.name
                        )
                    );

                }
            );


        // ==========================================
        // NO ROUNDS YET
        // ==========================================

        if (
            standingsArray.length === 0
        ) {

            container.innerHTML = `
                <div class="home-empty">
                    No rounds have been submitted yet.
                </div>
            `;

            return;

        }


        // ==========================================
        // TOP 3
        // ==========================================

        const topThree =
            standingsArray.slice(
                0,
                3
            );


        // ==========================================
        // TITLE
        // ==========================================

        const title =
            regularSeasonFinalized
                ? "FINAL IGA STANDINGS"
                : "CURRENT IGA LEADER";


        // ==========================================
        // FINALIZED LABEL
        // ==========================================

        const finalizedLabel =
            regularSeasonFinalized
                ? `
                    <div class="leader-finalized">
                        REGULAR SEASON FINALIZED
                    </div>
                `
                : "";


        // ==========================================
        // BUILD TOP 3
        // ==========================================

        container.innerHTML = `

            <div class="leader-header">

                <div class="leader-title">
                    ${title}
                </div>

                ${finalizedLabel}

            </div>


            <div class="leader-list">

                ${
                    topThree.map(
                        (
                            player,
                            index
                        ) => {

                            const rank =
                                index + 1;

                            return `

                               <div class="leader-list-row ${rank === 1 ? "leader-first" : ""}">

    <div class="leader-list-rank">
        ${rank}.
    </div>


    <div class="leader-list-player">

        <strong>
            ${player.name}
        </strong>

    </div>


    <div class="leader-list-rounds">

        <strong>
            ${player.rounds}
        </strong>

        <span>
            ROUNDS
        </span>

    </div>


    <div class="leader-list-points">

        <strong>
            ${player.points}
        </strong>

        <span>
            POINTS
        </span>

    </div>

</div>

                            `;

                        }
                    ).join("")
                }

            </div>

        `;


        console.log(
            "LIVE IGA STANDINGS:",
            standingsArray
        );


    } catch (error) {

        console.error(
            "CURRENT LEADER ERROR:",
            error
        );


        container.innerHTML = `
            <div class="home-error">
                Unable to load current IGA standings.
            </div>
        `;

    }

}



// ==========================================
// OPEN IGA ROUNDS
// ==========================================

async function loadOpenRounds(
    seasonId
) {

    const container =
        document.getElementById(
            "openRounds"
        );


    if (!container) {

        return;

    }


    // ------------------------------------------
    // GET OPEN EVENTS
    // ------------------------------------------

    const {
        data: events,
        error: eventError
    } = await supabaseClient

        .from("events_table")

        .select(`
    id,
    event_name,
    event_type,
    season_id,
    status,
    course_id,
    event_date,
    courses (
        "Course_name"
    )
`)

        .eq(
            "season_id",
            seasonId
        )

        .eq(
            "status",
            "Open"
        )

        .order(
            "event_date",
            {
                ascending: true
            }
        );


    if (eventError) {

        console.error(
            "OPEN ROUNDS ERROR:",
            eventError
        );

        container.innerHTML = `
            <div class="home-error">
                Unable to load open rounds.
            </div>
        `;

        return;

    }


    if (
        !events ||
        events.length === 0
    ) {

        container.innerHTML = `

            <div class="open-rounds-empty">

                <div class="open-rounds-icon">
                    ✓
                </div>

                <strong>
                    No Open Rounds
                </strong>

                <p>
                    All current IGA events are closed.
                </p>

            </div>

        `;

        return;

    }


    // ------------------------------------------
    // GET ACTIVE PLAYERS
    // ------------------------------------------

    const {
        data: activePlayers,
        error: playerError
    } = await supabaseClient

        .from("Players")

        .select(`
            player_id,
            "Name"
        `)

        .eq(
            "Active",
            true
        );


    if (playerError) {

        console.error(
            "ACTIVE PLAYERS ERROR:",
            playerError
        );

        container.innerHTML = `
            <div class="home-error">
                Unable to load IGA players.
            </div>
        `;

        return;

    }


    const totalPlayers =
        activePlayers?.length || 0;


    // ------------------------------------------
    // GET SUBMITTED ROUNDS
    // ------------------------------------------

    const eventIds =
        events.map(
            event =>
                event.id
        );


    const {
        data: rounds,
        error: roundError
    } = await supabaseClient

        .from("rounds")

        .select(`
            id,
            event_id,
            player_id,
            round_date,
            approval_status
        `)

        .in(
            "event_id",
            eventIds
        );

        console.log(
    "OPEN ROUND DATA:",
    rounds
);

    if (roundError) {

        console.error(
            "OPEN ROUND SUBMISSIONS ERROR:",
            roundError
        );

        container.innerHTML = `
            <div class="home-error">
                Unable to load round submissions.
            </div>
        `;

        return;

    }


    // ------------------------------------------
    // ONLY SHOW EVENTS WITH SUBMISSIONS
    // ------------------------------------------

    const eventsWithSubmissions =
        events.filter(
            event => {

                return (
                    rounds || []
                ).some(
                    round =>
                        round.event_id ===
                        event.id
                );

            }
        );


    // ------------------------------------------
    // NO EVENTS WITH SUBMISSIONS
    // ------------------------------------------

    if (
        eventsWithSubmissions.length === 0
    ) {

        container.innerHTML = `

            <div class="open-rounds-empty">

                <div class="open-rounds-icon">
                    ✓
                </div>

                <strong>
                    No Active Rounds
                </strong>

                <p>
                    No IGA rounds have been submitted yet.
                </p>

            </div>

        `;

        return;

    }


    // ------------------------------------------
    // CLEAR CONTAINER
    // ------------------------------------------

    container.innerHTML = "";


    // ------------------------------------------
    // BUILD EVENT CARDS
    // ------------------------------------------

    eventsWithSubmissions.forEach(
        event => {

            // ------------------------------------------
            // ROUNDS FOR THIS EVENT
            // ------------------------------------------

            const eventRounds =
                (rounds || [])
                    .filter(
                        round =>
                            round.event_id ===
                            event.id
                    );
  
// ------------------------------------------
// FIRST ROUND SUBMITTED DATE
// ------------------------------------------

const firstSubmittedRound =
    eventRounds
        .filter(
            round =>
                round.round_date
        )
        .sort(
            (a, b) =>
                new Date(a.round_date) -
                new Date(b.round_date)
        )[0];


const firstSubmittedDate =
    firstSubmittedRound?.round_date || null;


            // ------------------------------------------
            // UNIQUE PLAYERS WHO SUBMITTED
            // ------------------------------------------

            const submittedPlayers =
                new Set(
                    eventRounds.map(
                        round =>
                            round.player_id
                    )
                );


            const submittedCount =
                submittedPlayers.size;


            // ------------------------------------------
            // REMAINING PLAYERS
            // ------------------------------------------

            const remainingPlayers =
                Math.max(
                    totalPlayers -
                    submittedCount,
                    0
                );


            // ------------------------------------------
            // PENDING APPROVALS
            // ------------------------------------------

            const pendingApproval =
                eventRounds.filter(
                    round =>
                        round.approval_status ===
                        "Pending"
                ).length;


            // ------------------------------------------
            // COURSE NAME
            // ------------------------------------------

const courseName =
    event.courses?.Course_name ||
    "IGA Golf Course";


            // ------------------------------------------
            // STATUS
            // ------------------------------------------

            let statusText = "";


            if (
                remainingPlayers > 0
            ) {

                statusText = `

                    <div class="open-round-status">

                        <strong>
                            ${remainingPlayers}
                        </strong>

                        player${remainingPlayers === 1 ? "" : "s"}
                        still need${remainingPlayers === 1 ? "s" : ""} to play

                    </div>

                `;

            } else if (
                pendingApproval > 0
            ) {

                statusText = `

                    <div class="open-round-status pending">

                        Scores awaiting Commissioner approval

                    </div>

                `;

            } else {

                statusText = `

                    <div class="open-round-status complete">

                        All players submitted

                    </div>

                `;

            }


            // ------------------------------------------
            // CREATE CARD
            // ------------------------------------------

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "open-round-item";


            card.innerHTML = `

                <div class="open-round-top">

                    <div>

                        <div class="open-round-name">
                            ${event.event_name}
                        </div>

                        <div class="open-round-date">
    ${
        firstSubmittedDate
            ? formatHomeDate(
                firstSubmittedDate
            )
            : "Date TBD"
    }
</div>

                    </div>

                    <div class="open-round-count">

                        ${submittedCount}
                        /
                        ${totalPlayers}

                    </div>

                </div>


                <div class="open-round-course">

                    ${courseName}

                </div>


                ${statusText}

            `;


            container.appendChild(
                card
            );

        }
    );

}



// ==========================================
// RECENT ROUNDS
// ==========================================

async function loadRecentRounds(
    seasonId
) {

    const container =
        document.getElementById(
            "recentRounds"
        );


    if (!container) {

        return;

    }


    const {
        data: rounds,
        error
    } = await supabaseClient

        .from("rounds")

        .select(`
            id,
            player_id,
            round_date,
            gross_score,
            net_score,
            approval_status,

            "Players" (
                "Name"
            ),

            courses (
                "Course_name"
            )
        `)

        .eq(
            "season_id",
            seasonId
        )

        .eq(
            "approval_status",
            "Approved"
        )

        .order(
            "round_date",
            {
                ascending: false
            }
        )

        .limit(5);


    if (error) {

        console.error(
            "RECENT ROUNDS ERROR:",
            error
        );

        container.innerHTML = `
            <div class="home-error">
                Unable to load recent rounds.
            </div>
        `;

        return;

    }


    if (
        !rounds ||
        rounds.length === 0
    ) {

        container.innerHTML = `
            <div class="home-empty">
                No completed rounds yet.
            </div>
        `;

        return;

    }


    container.innerHTML = "";


    rounds.forEach(
        round => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "recent-round-item";


            item.innerHTML = `

                <div class="recent-round-player">

                    ${
                        round.Players?.Name ||
                        "Unknown Player"
                    }

                </div>


                <div class="recent-round-course">

                    ${
                        round.courses?.Course_name ||
                        "Unknown Course"
                    }

                </div>


                <div class="recent-round-score">

                    <span>
                        ${
                            round.gross_score ??
                            "—"
                        }
                        Gross
                    </span>

                    <span>
                        ${
                            round.net_score ??
                            "—"
                        }
                        Net
                    </span>

                </div>


                <div class="recent-round-date">

                    ${
                        round.round_date
                            ? formatHomeDate(
                                round.round_date
                            )
                            : ""
                    }

                </div>

            `;


            container.appendChild(
                item
            );

        }
    );

}



// ==========================================
// LEAGUE RECORDS
// ==========================================

async function loadLeagueRecords(
    seasonId
) {

    const container =
        document.getElementById(
            "leagueRecords"
        );


    if (!container) {

        return;

    }


    // ------------------------------------------
    // GET ROUNDS
    // ------------------------------------------

    const {
        data: rounds,
        error: roundError
    } = await supabaseClient

        .from("rounds")

        .select(`
            gross_score,
            net_score,
            birdies,
            eagles,
            player_id,

            "Players" (
                "Name"
            )
        `)

        .eq(
            "approval_status",
            "Approved"
        );


    if (roundError) {

        console.error(
            "RECORDS ERROR:",
            roundError
        );

        container.innerHTML = `
            <div class="home-error">
                Unable to load league records.
            </div>
        `;

        return;

    }


    if (
        !rounds ||
        rounds.length === 0
    ) {

        container.innerHTML = `
            <div class="home-empty">
                Records will appear after rounds are played.
            </div>
        `;

        return;

    }


    // ------------------------------------------
    // LOWEST NET ROUND
    // ------------------------------------------

    const validNetRounds =
        rounds.filter(
            round =>
                Number.isFinite(
                    Number(
                        round.net_score
                    )
                )
        );


    const lowestNet =
        validNetRounds.length
            ? validNetRounds.reduce(
                (
                    best,
                    round
                ) =>
                    Number(
                        round.net_score
                    )
                    <
                    Number(
                        best.net_score
                    )
                        ? round
                        : best
            )
            : null;


    // ------------------------------------------
    // MOST BIRDIES
    // ------------------------------------------

    const mostBirdies =
        rounds.reduce(
            (
                best,
                round
            ) =>
                Number(
                    round.birdies || 0
                )
                >
                Number(
                    best?.birdies || 0
                )
                    ? round
                    : best,
            null
        );


    // ------------------------------------------
    // MOST EAGLES
    // ------------------------------------------

    const mostEagles =
        rounds.reduce(
            (
                best,
                round
            ) =>
                Number(
                    round.eagles || 0
                )
                >
                Number(
                    best?.eagles || 0
                )
                    ? round
                    : best,
            null
        );


    // ------------------------------------------
    // LOWEST GROSS ROUND
    // ------------------------------------------

    const validGrossRounds =
        rounds.filter(
            round =>
                Number.isFinite(
                    Number(
                        round.gross_score
                    )
                )
        );


    const lowestGross =
        validGrossRounds.length
            ? validGrossRounds.reduce(
                (
                    best,
                    round
                ) =>
                    Number(
                        round.gross_score
                    )
                    <
                    Number(
                        best.gross_score
                    )
                        ? round
                        : best
            )
            : null;


    // ------------------------------------------
    // DISPLAY RECORDS
    // ------------------------------------------

    container.innerHTML = `

        <div class="record-row">

            <div class="record-title">
                Lowest Net Round
            </div>

            <div class="record-value">
                ${
                    lowestNet
                        ? Number(
                            lowestNet.net_score
                        )
                        : "—"
                }
            </div>

            <div class="record-player">
                ${
                    lowestNet?.Players?.Name ||
                    "—"
                }
            </div>

        </div>


        <div class="record-row">

            <div class="record-title">
                Lowest Gross Round
            </div>

            <div class="record-value">
                ${
                    lowestGross
                        ? Number(
                            lowestGross.gross_score
                        )
                        : "—"
                }
            </div>

            <div class="record-player">
                ${
                    lowestGross?.Players?.Name ||
                    "—"
                }
            </div>

        </div>


        <div class="record-row">

            <div class="record-title">
                Most Birdies — Round
            </div>

            <div class="record-value">
                ${
                    mostBirdies
                        ? Number(
                            mostBirdies.birdies || 0
                        )
                        : "—"
                }
            </div>

            <div class="record-player">
                ${
                    mostBirdies?.Players?.Name ||
                    "—"
                }
            </div>

        </div>


        <div class="record-row">

            <div class="record-title">
                Most Eagles — Round
            </div>

            <div class="record-value">
                ${
                    mostEagles
                        ? Number(
                            mostEagles.eagles || 0
                        )
                        : "—"
                }
            </div>

            <div class="record-player">
                ${
                    mostEagles?.Players?.Name ||
                    "—"
                }
            </div>

        </div>

    `;

}



// ==========================================
// DATE FORMATTER
// ==========================================

function formatHomeDate(
    date
) {

    if (!date) {

        return "";

    }


    const formatted =
        new Date(
            date + "T00:00:00"
        );


    return formatted.toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "numeric",
            year: "numeric"
        }
    );

}



// ==========================================
// START HOMEPAGE
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadHomePage();

    }
);