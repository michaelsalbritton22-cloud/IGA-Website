// ==========================================
// IGA SUPABASE DATABASE
// ==========================================

const SUPABASE_URL = "https://gvxafuhuxvwjsaeqwlrm.supabase.co";
const SUPABASE_KEY = "sb_publishable_VrKBzTXcDhrGodnR-5GW3Q_Q-u2Azb3";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ==========================================
// GET PENDING ROUNDS
// ==========================================

async function getPendingRounds() {

    const { data, error } = await supabaseClient

        .from("rounds")

        .select(`
            id,
            player_id,
            course_id,
            round_date,
            gross_score,
            net_score,
            handicap_used,
            points_earned,
            birdies,
            eagles,
            pars,
            bogeys,
            double_bogeys,
            fairways_hit,
            greens_hit,
            putts,
            Notes,
            season_id,
            event_id,
            approval_status,
            approved_by,
            approved_date,
            counts_for_qualification,

            "Players" (
                "Name",
                "Handicap"
            ),

            courses (
                "Course_name",
                par,
                "Location"
            )
        `)

        .eq("approval_status", "Pending")

        .order("round_date", {
            ascending: false
        });


    if (error) {

        console.error(
            "ERROR LOADING PENDING ROUNDS:",
            error
        );

        throw error;

    }


    console.log(
        "Pending IGA rounds:",
        data
    );


    // ------------------------------------------
    // GET PLAYING GROUPS
    // ------------------------------------------

    const roundIds = data.map(round => round.id);


    if (roundIds.length === 0) {

        return [];

    }


    const {
        data: participants,
        error: participantError
    } = await supabaseClient

        .from("round_participants")

        .select(`
            round_id,
            player_id,

            "Players" (
                "Name"
            )
        `)

        .in("round_id", roundIds);


    if (participantError) {

        console.error(
            "ERROR LOADING ROUND PARTICIPANTS:",
            participantError
        );

        throw participantError;

    }


    // ------------------------------------------
    // ADD PLAYING GROUP TO EACH ROUND
    // ------------------------------------------

    data.forEach(round => {

        round.playingGroup =
            participants

                .filter(
                    participant =>
                        participant.round_id === round.id
                )

                .map(
                    participant =>
                        participant.Players.Name
                );

    });


    return data;

}

// ==========================================
// CHECK PLAYER QUALIFICATION
// ==========================================

async function getQualificationStatus(
    playerId,
    courseId,
    seasonId
) {

    // --------------------------------------
    // GET REQUIRED ROUNDS
    // --------------------------------------

    const {
        data: requirement,
        error: requirementError
    } = await supabaseClient

        .from("season_requirements")

        .select(`
            required_rounds
        `)

        .eq("course_id", courseId)

        .eq("season", seasonId)

        .maybeSingle();


    if (requirementError) {

        console.error(
            "Qualification requirement error:",
            requirementError
        );

        throw requirementError;

    }


    // --------------------------------------
    // NO REQUIREMENT
    // --------------------------------------

    if (
        !requirement ||
        !requirement.required_rounds ||
        requirement.required_rounds === 0
    ) {

        return {

            required: 0,

            completed: 0,

            countsForQualification: false,

            message:
                "No qualifying rounds required"

        };

    }


    // --------------------------------------
    // COUNT PREVIOUS APPROVED ROUNDS
    // --------------------------------------

    const {
        count,
        error: roundError
    } = await supabaseClient

        .from("rounds")

        .select(
            "id",
            {
                count: "exact",
                head: true
            }
        )

        .eq("player_id", playerId)

        .eq("course_id", courseId)

        .eq("season_id", seasonId)

        .eq("approval_status", "Approved")

        .eq("counts_for_qualification", true);


    if (roundError) {

        console.error(
            "Qualification round error:",
            roundError
        );

        throw roundError;

    }


    const completed =
        count || 0;


    // --------------------------------------
    // DETERMINE STATUS
    // --------------------------------------

    if (
        completed <
        requirement.required_rounds
    ) {

        return {

            required:
                requirement.required_rounds,

            completed:
                completed,

            countsForQualification:
                true,

            message:
                `Round ${completed + 1} of ${requirement.required_rounds}`

        };

    }


    return {

        required:
            requirement.required_rounds,

        completed:
            completed,

        countsForQualification:
            false,

        message:
            `Qualification complete (${completed} of ${requirement.required_rounds})`

    };

}

// ==========================================
// GET KINGS OF THE COURSES
// ==========================================
//
// Determines the King of each qualifying course
// based on the lowest combined net score after
// completing the required number of rounds.
//
// Only APPROVED rounds with
// counts_for_qualification = true are included.
// ==========================================

async function getKingsOfCourses(seasonId) {

    console.log(
        "Calculating Kings of the Courses:",
        seasonId
    );


    // ==========================================
    // GET COURSE REQUIREMENTS
    // ==========================================

    const {
        data: requirements,
        error: requirementError
    } = await supabaseClient

        .from("season_requirements")

        .select(`
            course_id,
            required_rounds
        `)

        .eq(
            "season",
            seasonId
        )

        .gt(
            "required_rounds",
            0
        );


    if (requirementError) {

        console.error(
            "ERROR LOADING COURSE REQUIREMENTS:",
            requirementError
        );

        throw requirementError;

    }


    if (
        !requirements ||
        requirements.length === 0
    ) {

        return [];

    }


    // ==========================================
    // GET COURSE INFORMATION
    // ==========================================

    const courseIds =
        requirements.map(
            requirement =>
                requirement.course_id
        );


    const {
        data: courses,
        error: courseError
    } = await supabaseClient

        .from("courses")

        .select(`
            course_id,
            "Course_name",
            "Location",
            par
        `)

        .in(
            "course_id",
            courseIds
        );


    if (courseError) {

        console.error(
            "ERROR LOADING COURSES:",
            courseError
        );

        throw courseError;

    }


    // ==========================================
    // GET QUALIFYING ROUNDS
    // ==========================================

    const {
        data: rounds,
        error: roundError
    } = await supabaseClient

        .from("rounds")

        .select(`
            id,
            player_id,
            course_id,
            season_id,
            round_date,
            net_score,
            approval_status,
            counts_for_qualification,

            "Players" (
                "Name"
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

        .eq(
            "counts_for_qualification",
            true
        )

        .in(
            "course_id",
            courseIds
        )

        .order(
            "round_date",
            {
                ascending: true
            }
        );


    if (roundError) {

        console.error(
            "ERROR LOADING QUALIFYING ROUNDS:",
            roundError
        );

        throw roundError;

    }


    // ==========================================
    // CALCULATE KING FOR EACH COURSE
    // ==========================================

    const kings = [];


    for (
        const requirement
        of requirements
    ) {

        const course =
            courses.find(
                c =>
                    c.course_id ===
                    requirement.course_id
            );


        if (!course) {

            continue;

        }


        // --------------------------------------
        // GET ROUNDS FOR THIS COURSE
        // --------------------------------------

        const courseRounds =
            rounds.filter(
                round =>
                    round.course_id ===
                    requirement.course_id
            );


        // --------------------------------------
        // GROUP ROUNDS BY PLAYER
        // --------------------------------------

        const playerGroups = {};


        courseRounds.forEach(
            round => {

                if (
                    !playerGroups[
                        round.player_id
                    ]
                ) {

                    playerGroups[
                        round.player_id
                    ] = [];

                }


                playerGroups[
                    round.player_id
                ].push(round);

            }
        );


        // --------------------------------------
        // FIND QUALIFIED PLAYERS
        // --------------------------------------

        const qualifiedPlayers = [];


        Object.entries(
            playerGroups
        ).forEach(
            (
                [
                    playerId,
                    playerRounds
                ]
            ) => {

                // ----------------------------------
                // A PLAYER MUST COMPLETE
                // ALL REQUIRED ROUNDS
                // ----------------------------------

                if (
                    playerRounds.length <
                    requirement.required_rounds
                ) {

                    return;

                }


                // ----------------------------------
                // USE THE REQUIRED NUMBER OF ROUNDS
                // ----------------------------------

                const qualifyingRounds =
                    playerRounds
                        .slice(
                            0,
                            requirement.required_rounds
                        );


                // ----------------------------------
                // CALCULATE COMBINED NET
                // ----------------------------------

                const combinedNet =
                    qualifyingRounds.reduce(
                        (
                            total,
                            round
                        ) =>
                            total +
                            (
                                Number(
                                    round.net_score
                                ) || 0
                            ),
                        0
                    );


                qualifiedPlayers.push({

                    playerId:
                        playerId,

                    playerName:
                        qualifyingRounds[0]
                            ?.Players
                            ?.Name ||
                        "Unknown",

                    rounds:
                        qualifyingRounds,

                    combinedNet:
                        combinedNet

                });

            }
        );


        // --------------------------------------
        // SORT LOWEST COMBINED NET FIRST
        // --------------------------------------

        qualifiedPlayers.sort(
            (
                a,
                b
            ) =>
                a.combinedNet -
                b.combinedNet
        );


        // --------------------------------------
        // GET KING
        // --------------------------------------

        const king =
            qualifiedPlayers.length > 0
                ? qualifiedPlayers[0]
                : null;


        kings.push({

            courseId:
                requirement.course_id,

            courseName:
                course.Course_name,

            location:
                course.Location,

            requiredRounds:
                requirement.required_rounds,

            champion:
                king,

            qualifiedPlayers:
                qualifiedPlayers

        });

    }


    console.log(
        "Kings of the Courses:",
        kings
    );


    return kings;

}

// ==========================================
// APPROVE ROUND GROUP
// ==========================================

// ==========================================
// APPROVE INDIVIDUAL SCORE
// ==========================================

async function approveIndividualRound(
    roundId,
    approvedBy = "Commissioner"
) {

    console.log(
        "Approving individual score:",
        roundId
    );


    // ==========================================
    // GET ROUND
    // ==========================================

    const {
        data: round,
        error: loadError
    } = await supabaseClient

        .from("rounds")

        .select(`
            id,
            player_id,
            course_id,
            round_date,
            net_score,
            season_id,
            event_id,
            approval_status
        `)

        .eq("id", roundId)

        .single();


    if (loadError) {

        console.error(
            "ERROR LOADING ROUND:",
            loadError
        );

        throw loadError;

    }


    if (!round) {

        throw new Error(
            "Round could not be found."
        );

    }


    // ==========================================
    // MAKE SURE IT IS STILL PENDING
    // ==========================================

    if (
        round.approval_status !==
        "Pending"
    ) {

        throw new Error(
            "This score has already been approved."
        );

    }


    // ==========================================
    // APPROVE SCORE
    //
    // IMPORTANT:
    // We DO NOT calculate placement
    // or permanent points here.
    // ==========================================

    const {
        error: updateError
    } = await supabaseClient

        .from("rounds")

        .update({

            approval_status:
                "Approved",

            approved_by:
                approvedBy,

            approved_date:
                new Date().toISOString(),

            counts_for_qualification:
                true,

            finish_position:
                null,

            points_earned:
                0

        })

        .eq("id", roundId)

        .eq("approval_status", "Pending");


    if (updateError) {

        console.error(
            "ERROR APPROVING SCORE:",
            updateError
        );

        throw updateError;

    }


    console.log(
        "Individual score approved:",
        roundId
    );


    return true;

}

// ==========================================
// GET PROVISIONAL EVENT STANDINGS
// ==========================================

async function getEventStandings(eventId) {

    console.log(
        "Calculating provisional standings:",
        eventId
    );


    // ==========================================
    // GET APPROVED SCORES
    // ==========================================

    const {
        data: rounds,
        error
    } = await supabaseClient

        .from("rounds")

        .select(`
            id,
            player_id,
            net_score,
            gross_score,
            handicap_used,
            season_id,
            event_id,

            "Players" (
                "Name"
            )
        `)

        .eq("event_id", eventId)

        .eq("approval_status", "Approved")

        .order("net_score", {
            ascending: true
        });


    if (error) {

        console.error(
            "ERROR LOADING EVENT STANDINGS:",
            error
        );

        throw error;

    }


    if (!rounds) {

        return [];

    }


    // ==========================================
    // CALCULATE CURRENT PLACEMENT
    // ==========================================

    let previousScore = null;

    let currentPosition = 0;


    rounds.forEach(
        (round, index) => {


            const score =
                Number(round.net_score);


            if (
                score !==
                previousScore
            ) {

                currentPosition =
                    index + 1;

            }


            previousScore =
                score;


            round.finish_position =
                currentPosition;


            // ==========================================
            // CURRENT PROVISIONAL POINTS
            // ==========================================

            const points = {

                1: 100,
                2: 85,
                3: 75,
                4: 65,
                5: 55,
                6: 45,
                7: 35,
                8: 25,
                9: 20,
                10: 15

            };


            round.provisional_points =
                points[currentPosition] || 0;

        }
    );


    return rounds;

}

// ==========================================
// FINALIZE EVENT
// ==========================================

async function finalizeEvent(
    eventId,
    approvedBy = "Commissioner"
) {

    console.log(
        "FINALIZING EVENT:",
        eventId
    );


    // ==========================================
    // GET EVENT
    // ==========================================

    const {
        data: event,
        error: eventError
    } = await supabaseClient

        .from("events_table")

        .select(`
            id,
            event_name,
            status,
            season_id,
            course_id
        `)

        .eq("id", eventId)

        .single();


    if (eventError) {

        throw eventError;

    }


    if (
        event.status ===
        "Finalized"
    ) {

        throw new Error(
            "This event has already been finalized."
        );

    }


    // ==========================================
// CHECK EVENT SUBMISSIONS
// ==========================================

const {
    data: eventRounds,
    error: submissionError
} = await supabaseClient

    .from("rounds")

    .select(`
        id,
        player_id,
        approval_status
    `)

    .eq(
        "event_id",
        eventId
    );


if (submissionError) {

    throw submissionError;

}


// ==========================================
// GET ACTIVE PLAYERS
// ==========================================

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

    throw playerError;

}


// ==========================================
// CALCULATE SUBMISSION STATUS
// ==========================================

const submittedPlayers =
    new Set(
        eventRounds.map(
            round =>
                round.player_id
        )
    );


const submittedCount =
    submittedPlayers.size;


const totalPlayers =
    activePlayers.length;


const missingPlayers =
    activePlayers.filter(
        player =>
            !submittedPlayers.has(
                player.player_id
            )
    );


// ==========================================
// CHECK FOR PENDING SCORES
// ==========================================

const pendingRounds =
    eventRounds.filter(
        round =>
            round.approval_status ===
            "Pending"
    );


// ==========================================
// WARN COMMISSIONER
// ==========================================

if (
    missingPlayers.length > 0 ||
    pendingRounds.length > 0
) {

    let message =
        "This event is not fully complete.\n\n";


    message +=
        `${submittedCount} of ${totalPlayers} `
        +
        `active players have submitted.\n`;


    if (
        missingPlayers.length > 0
    ) {

        message +=
            `\nPlayers without a submission:\n`;


        missingPlayers.forEach(
            player => {

                message +=
                    `• ${player.Name}\n`;

            }
        );

    }


    if (
        pendingRounds.length > 0
    ) {

        message +=
            `\n${pendingRounds.length} `
            +
            `score(s) are still pending approval.\n`;

    }


    message +=
        `\nDo you want to finalize the event anyway?`;


    const confirmed =
        confirm(message);


    if (!confirmed) {

        throw new Error(
            "Event finalization cancelled by Commissioner."
        );

    }

}


// ==========================================
// GET ALL APPROVED SCORES
// ==========================================

const standings =
    await getEventStandings(
        eventId
    );


if (
    standings.length === 0
) {

    throw new Error(
        "There are no approved scores to finalize."
    );

}

    // ==========================================
    // SAVE FINAL RESULTS
    // ==========================================

    for (
        const round
        of standings
    ) {


        const {
            error
        } = await supabaseClient

            .from("rounds")

            .update({

                finish_position:
                    round.finish_position,

                points_earned:
                    round.provisional_points

            })

            .eq(
                "id",
                round.id
            );


        if (error) {

            throw error;

        }

    }

    // ==========================================
// UPDATE SEASON POINTS
// ==========================================

await updateSeasonPoints(
    standings,
    event.season_id
);

    // ==========================================
    // MARK EVENT FINAL
    // ==========================================

    const {
        error: finalError
    } = await supabaseClient

        .from("events_table")

        .update({

            status:
                "Finalized"

        })

        .eq(
            "id",
            eventId
        );


    if (finalError) {

        throw finalError;

    }


    console.log(
        "EVENT FINALIZED:",
        eventId
    );


    return standings;

}

// ==========================================
// UPDATE SEASON POINTS AFTER EVENT FINALIZATION
// ==========================================

async function updateSeasonPoints(
    standings,
    seasonId
) {

    console.log(
        "UPDATING SEASON POINTS:",
        seasonId
    );


    // ==========================================
    // GET EXISTING SEASON POINT RECORDS
    // ==========================================

    const {
        data: existingPlayers,
        error: existingError
    } = await supabaseClient

        .from("season_points")

        .select(`
            id,
            Player_id,
            season_id,
            total_points,
            rounds_played,
            birdies,
            wins,
            top_3_finishes,
            eagles,
            average_score,
            low_round
        `)

        .eq(
            "season_id",
            seasonId
        );


    if (existingError) {

        throw existingError;

    }


    // ==========================================
    // UPDATE EACH PLAYER
    // ==========================================

    for (
        const round
        of standings
    ) {

        const playerId =
            round.player_id;


        // ------------------------------------------
        // FIND EXISTING SEASON RECORD
        // ------------------------------------------

        const existing =
            existingPlayers.find(
                player =>
                    player.Player_id ===
                    playerId
            );


        // ------------------------------------------
        // GET ALL FINALIZED ROUNDS
        // ------------------------------------------

        const {
            data: finalizedRounds,
            error: roundsError
        } = await supabaseClient

            .from("rounds")

            .select(`
                net_score,
                points_earned,
                birdies,
                eagles,
                finish_position
            `)

            .eq(
                "player_id",
                playerId
            )

            .eq(
                "season_id",
                seasonId
            )

            .eq(
                "approval_status",
                "Approved"
            );


        if (roundsError) {

            throw roundsError;

        }


        // ==========================================
        // CALCULATE SEASON TOTALS
        // ==========================================

        const roundsPlayed =
            finalizedRounds.length;


        const totalPoints =
            finalizedRounds.reduce(
                (
                    total,
                    r
                ) =>
                    total +
                    (
                        Number(
                            r.points_earned
                        ) || 0
                    ),
                0
            );


        const birdies =
            finalizedRounds.reduce(
                (
                    total,
                    r
                ) =>
                    total +
                    (
                        Number(
                            r.birdies
                        ) || 0
                    ),
                0
            );


        const eagles =
            finalizedRounds.reduce(
                (
                    total,
                    r
                ) =>
                    total +
                    (
                        Number(
                            r.eagles
                        ) || 0
                    ),
                0
            );


        const wins =
            finalizedRounds.filter(
                r =>
                    r.finish_position ===
                    1
            ).length;


        const top3 =
            finalizedRounds.filter(
                r =>
                    r.finish_position <=
                    3
            ).length;


        const scores =
            finalizedRounds
                .map(
                    r =>
                        Number(
                            r.net_score
                        )
                )
                .filter(
                    score =>
                        !isNaN(score)
                );


        const averageScore =
            scores.length
                ? Math.round(
                    scores.reduce(
                        (
                            total,
                            score
                        ) =>
                            total +
                            score,
                        0
                    )
                    /
                    scores.length
                )
                : 0;


        const lowRound =
            scores.length
                ? Math.min(
                    ...scores
                )
                : 0;


        // ==========================================
        // UPDATE EXISTING RECORD
        // ==========================================

        if (existing) {

            const {
                error: updateError
            } = await supabaseClient

                .from("season_points")

                .update({

                    total_points:
                        totalPoints,

                    rounds_played:
                        roundsPlayed,

                    birdies:
                        birdies,

                    wins:
                        wins,

                    top_3_finishes:
                        top3,

                    eagles:
                        eagles,

                    average_score:
                        averageScore,

                    low_round:
                        lowRound

                })

                .eq(
                    "id",
                    existing.id
                );


            if (updateError) {

                throw updateError;

            }

        }

        // ==========================================
        // CREATE NEW RECORD
        // ==========================================

        else {

            const {
                error: insertError
            } = await supabaseClient

                .from("season_points")

                .insert({

                    Player_id:
                        playerId,

                    season_id:
                        seasonId,

                    total_points:
                        totalPoints,

                    rounds_played:
                        roundsPlayed,

                    birdies:
                        birdies,

                    wins:
                        wins,

                    top_3_finishes:
                        top3,

                    eagles:
                        eagles,

                    average_score:
                        averageScore,

                    low_round:
                        lowRound

                });


            if (insertError) {

                throw insertError;

            }

        }

    }


    console.log(
        "SEASON POINTS UPDATED:",
        seasonId
    );

}

// ==========================================
// GET OPEN EVENTS
// ==========================================

async function getOpenEvents() {

    const {
        data: events,
        error
    } = await supabaseClient

        .from("events_table")

        .select(`
            id,
            event_name,
            event_type,
            season_id,
            status,
            course_id,
            event_date
        `)

        .eq("status", "Open")

        .order("event_date", {
            ascending: false
        });


    if (error) {

        console.error(
            "ERROR LOADING OPEN EVENTS:",
            error
        );

        throw error;

    }


    if (!events || events.length === 0) {

        console.log(
            "Open IGA events: []"
        );

        return [];

    }


    // ------------------------------------------
    // GET COURSE INFORMATION
    // ------------------------------------------

    const courseIds = [
        ...new Set(
            events.map(
                event => event.course_id
            )
        )
    ];


    const {
        data: courses,
        error: courseError
    } = await supabaseClient

        .from("courses")

        .select(`
            course_id,
            "Course_name",
            "Location",
            par
        `)

        .in(
            "course_id",
            courseIds
        );


    if (courseError) {

        console.error(
            "ERROR LOADING EVENT COURSES:",
            courseError
        );

        throw courseError;

    }


    // ------------------------------------------
    // ATTACH COURSE TO EVENT
    // ------------------------------------------

    events.forEach(event => {

        event.courses =
            courses.find(
                course =>
                    course.course_id ===
                    event.course_id
            );

    });


    console.log(
        "Open IGA events:",
        events
    );


    return events;

}

// ==========================================
// GET ACTIVE PLAYERS
// ==========================================

async function getActivePlayers() {

    const {
        data: players,
        error
    } = await supabaseClient

        .from("Players")

        .select(`
            player_id,
            "Name",
            "Home Town",
            "Handicap",
            "Active"
        `)

        .eq(
            "Active",
            true
        )

        .order(
            "Name",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "ERROR LOADING PLAYERS:",
            error
        );

        throw error;

    }


    console.log(
        "Active IGA Players:",
        players
    );


    return players || [];

}

// ==========================================
// GET OPEN EVENT ROSTER
// ==========================================

async function getOpenEventRoster(eventId) {

    // --------------------------------------
    // GET EVENT
    // --------------------------------------

    const {
        data: event,
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
            event_date
        `)

        .eq("id", eventId)

        .single();


    if (eventError) {

        console.error(
            "ERROR LOADING EVENT:",
            eventError
        );

        throw eventError;

    }


    // --------------------------------------
    // GET COURSE
    // --------------------------------------

    const {
        data: course,
        error: courseError
    } = await supabaseClient

        .from("courses")

        .select(`
            course_id,
            "Course_name",
            "Location",
            par
        `)

        .eq(
            "course_id",
            event.course_id
        )

        .single();


    if (courseError) {

        console.error(
            "ERROR LOADING EVENT COURSE:",
            courseError
        );

        throw courseError;

    }


    // --------------------------------------
    // GET ALL ACTIVE PLAYERS
    // --------------------------------------

    const {
        data: players,
        error: playerError
    } = await supabaseClient

        .from("Players")

        .select(`
            player_id,
            "Name",
            "Home Town",
            "Handicap",
            Active
        `)

        .eq(
            "Active",
            true
        )

        .order(
            "Name",
            {
                ascending: true
            }
        );


    if (playerError) {

        console.error(
            "ERROR LOADING EVENT PLAYERS:",
            playerError
        );

        throw playerError;

    }


    // --------------------------------------
    // GET ROUNDS FOR THIS EVENT
    // --------------------------------------

    const {
        data: rounds,
        error: roundError
    } = await supabaseClient

        .from("rounds")

        .select(`
            id,
            player_id,
            event_id,
            round_date,
            gross_score,
            net_score,
            handicap_used,
            points_earned,
            approval_status,
            counts_for_qualification
        `)

        .eq(
            "event_id",
            eventId
        );


    if (roundError) {

        console.error(
            "ERROR LOADING EVENT ROUNDS:",
            roundError
        );

        throw roundError;

    }


    // --------------------------------------
    // COMBINE PLAYERS + ROUNDS
    // --------------------------------------

    const roster = players.map(player => {

        const round =
            rounds.find(
                r =>
                    r.player_id ===
                    player.player_id
            );


        return {

            player: player,

            round: round || null

        };

    });


    return {

        event: event,

        course: course,

        roster: roster

    };

}

getOpenEventRoster(1)
    .then(data => {

        console.log(
            "IGA EVENT ROSTER:",
            data
        );

    })
    .catch(error => {

        console.error(
            "IGA EVENT ROSTER ERROR:",
            error
        );

    });

    // ==========================================
// COMMISSIONER SCORE ENTRY
// ==========================================

// ------------------------------------------
// CALCULATE HANDICAP STROKES FOR A HOLE
// ------------------------------------------

function calculateHandicapStrokes(
    handicapUsed,
    holeHandicapIndex
) {

    const handicap =
        Math.max(
            0,
            Math.floor(
                Number(handicapUsed) || 0
            )
        );

    const index =
        Number(holeHandicapIndex);


    if (!index || index < 1 || index > 18) {

        return 0;

    }


    // Base stroke on every hole
    const baseStrokes =
        Math.floor(
            handicap / 18
        );


    // Remaining strokes
    const remainder =
        handicap % 18;


    return (
        baseStrokes
        +
        (
            index <= remainder
                ? 1
                : 0
        )
    );

}


// ------------------------------------------
// GET COURSE HOLES
// ------------------------------------------

async function getCourseHoles(courseId) {

    const {
        data,
        error
    } = await supabaseClient

        .from("course_holes")

        .select(`
            id,
            course_id,
            hole_number,
            par,
            handicap_index
        `)

        .eq(
            "course_id",
            courseId
        )

        .order(
            "hole_number",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "ERROR LOADING COURSE HOLES:",
            error
        );

        throw error;

    }


    if (!data || data.length !== 18) {

        throw new Error(
            `This course must have 18 holes configured. ` +
            `Found ${data?.length || 0}.`
        );

    }


    return data;

}


// ------------------------------------------
// SAVE COMMISSIONER ROUND
// ------------------------------------------

async function saveCommissionerRound({
    eventId,
    playerId,
    handicapUsed,
    roundDate,
    grossScores,
    netScore,
    notes = ""
}) {

    console.log(
        "Saving Commissioner Round:",
        {
            eventId,
            playerId,
            handicapUsed,
            roundDate,
            grossScores
        }
    );


    // ==========================================
    // VALIDATE INPUT
    // ==========================================

    if (!eventId) {

        throw new Error(
            "An event must be selected."
        );

    }


    if (!playerId) {

        throw new Error(
            "A player must be selected."
        );

    }


    if (
        handicapUsed === null ||
        handicapUsed === undefined ||
        handicapUsed === ""
    ) {

        throw new Error(
            "Handicap used is required."
        );

    }


    if (
        !Array.isArray(grossScores) ||
        grossScores.length !== 18
    ) {

        throw new Error(
            "Exactly 18 hole scores are required."
        );

    }



// ==========================================
// VALIDATE 18BIRDIES NET SCORE
// ==========================================

if (
    netScore === null ||
    netScore === undefined ||
    netScore === "" ||
    !Number.isFinite(Number(netScore))
) {

    throw new Error(
        "A valid 18Birdies net score is required."
    );

}

    const invalidScore =
        grossScores.some(
            score => {

                const number =
                    Number(score);

                return (
                    !Number.isInteger(number)
                    ||
                    number < 1
                    ||
                    number > 20
                );

            }
        );


    if (invalidScore) {

        throw new Error(
            "Each hole score must be a whole number between 1 and 20."
        );

    }


    // ==========================================
    // GET EVENT
    // ==========================================

    const {
        data: event,
        error: eventError
    } = await supabaseClient

        .from("events_table")

        .select(`
            id,
            event_name,
            event_date,
            season_id,
            course_id,
            status
        `)

        .eq(
            "id",
            eventId
        )

        .single();


    if (eventError) {

        throw eventError;

    }


    if (!event) {

        throw new Error(
            "Event could not be found."
        );

    }


    if (
        event.status !== "Open"
    ) {

        throw new Error(
            "This event is not open for score entry."
        );

    }


    // ==========================================
    // GET PLAYER
    // ==========================================

    const {
        data: player,
        error: playerError
    } = await supabaseClient

        .from("Players")

        .select(`
            player_id,
            "Name",
            "Handicap",
            Active
        `)

        .eq(
            "player_id",
            playerId
        )

        .single();


    if (playerError) {

        throw playerError;

    }


    if (!player) {

        throw new Error(
            "Player could not be found."
        );

    }


    if (!player.Active) {

        throw new Error(
            "This player is not active."
        );

    }


    // ==========================================
    // GET COURSE HOLES
    // ==========================================

    const holes =
        await getCourseHoles(
            event.course_id
        );


    // ==========================================
    // CALCULATE HOLE SCORES
    // ==========================================

    const holeRecords = [];


let grossTotal = 0;

let birdies = 0;

let eagles = 0;

let pars = 0;

let bogeys = 0;

let doubleBogeys = 0;


    holes.forEach(
    hole => {

        const holeNumber =
            hole.hole_number;


        const gross =
            Number(
                grossScores[
                    holeNumber - 1
                ]
            );


        // ==========================================
        // ADD TO GROSS TOTAL
        // ==========================================

        grossTotal +=
            gross;

            const par =
    Number(
        hole.par
    );

const scoreDifference =
    gross - par;

if (scoreDifference === -2) {

    eagles++;

}

else if (scoreDifference === -1) {

    birdies++;

}

else if (scoreDifference === 0) {

    pars++;

}

else if (scoreDifference === 1) {

    bogeys++;

}

else if (scoreDifference === 2) {

    doubleBogeys++;

}

        // ==========================================
        // HOLE RECORD
        // ==========================================

        holeRecords.push({

    hole_number:
        holeNumber,

    gross_score:
        gross,

    handicap_strokes:
        calculateHandicapStrokes(
            Number(handicapUsed),
            hole.handicap_index
        )

});

    }
);


    // ==========================================
    // CHECK FOR EXISTING ROUND
    // ==========================================

    const {
        data: existingRound,
        error: existingError
    } = await supabaseClient

        .from("rounds")

        .select(`
            id,
            approval_status
        `)

        .eq(
            "event_id",
            eventId
        )

        .eq(
            "player_id",
            playerId
        )

        .maybeSingle();


    if (existingError) {

        throw existingError;

    }


    if (existingRound) {

        throw new Error(
            `${player.Name} already has a round entered for this event.`
        );

    }


    // ==========================================
    // DETERMINE QUALIFICATION STATUS
    // ==========================================

    const qualification =
        await getQualificationStatus(
            playerId,
            event.course_id,
            event.season_id
        );


    // ==========================================
    // CREATE ROUND RECORD
    // ==========================================

    const {
        data: round,
        error: roundError
    } = await supabaseClient

        .from("rounds")

        .insert({

            player_id:
                playerId,

            course_id:
                event.course_id,

            round_date:
                roundDate ||
                event.event_date,

            gross_score:
                grossTotal,

            net_score:
                Number(netScore),

            handicap_used:
                Number(
                    handicapUsed
                ),

            points_earned:
                0,

            birdies:
                birdies,

            eagles:
                eagles,

            pars:
                pars,

            bogeys:
                bogeys,

            double_bogeys:
                doubleBogeys,

            fairways_hit:
                null,

            greens_hit:
                null,

            putts:
                null,

            Notes:
                notes || null,

            season_id:
                event.season_id,

            event_id:
                eventId,

            approval_status:
                "Pending",

            counts_for_qualification:
                qualification.countsForQualification

        })

        .select("id")

        .single();


    if (roundError) {

        console.error(
            "ERROR CREATING ROUND:",
            roundError
        );

        throw roundError;

    }


   // ==========================================
// ADD 18 HOLE RECORDS
// ==========================================

const records =
    holeRecords.map(
        hole => ({

            round_id:
                round.id,

            hole_number:
                Number(
                    hole.hole_number
                ),

            gross_score:
                Number(
                    hole.gross_score
                ),

            handicap_strokes:
                Number(
                    hole.handicap_strokes
                )

        })
    );


console.log(
    "ROUND HOLES BEING INSERTED:",
    records
);


if (
    records.length !== 18
) {

    throw new Error(
        `Expected 18 hole records, but found ${records.length}.`
    );

}


const {
    data: savedHoles,
    error: holeError
} = await supabaseClient

    .from("round_holes")

    .insert(records)

    .select(
        "id, round_id, hole_number, gross_score, handicap_strokes, net_score"
    );


if (holeError) {

    await supabaseClient

        .from("rounds")

        .delete()

        .eq(
            "id",
            round.id
        );


    console.error(
        "ERROR SAVING ROUND HOLES:",
        holeError
    );

    throw holeError;

}


console.log(
    "ROUND HOLES SAVED:",
    savedHoles
);

    // ==========================================
    // RETURN SAVED ROUND
    // ==========================================

    return {

        roundId:
            round.id,

        player:
            player,

        grossScore:
            grossTotal,

        netScore:
            Number(netScore),

        handicapUsed:
            Number(
                handicapUsed
            ),

        holes:
            holeRecords,

        qualification:
            qualification

    };

}

// ==========================================
// GET PLAYER STATS
// ==========================================

// ==========================================
// GET PLAYER STATS
// ==========================================

async function getPlayerStats(playerId) {

    console.log(
        "Getting stats for player:",
        playerId
    );


    const {
        data: rounds,
        error
    } = await supabaseClient

        .from("rounds")

        .select(`
            id,
            player_id,
            gross_score,
            net_score,
            points_earned,
            birdies,
            eagles,
            pars,
            bogeys,
            double_bogeys,
            approval_status,
            finish_position
        `)

        .eq(
            "player_id",
            playerId
        )

        .eq(
            "approval_status",
            "Approved"
        );


    if (error) {

        console.error(
            "ERROR LOADING PLAYER STATS:",
            error
        );

        throw error;

    }


    console.log(
        `Approved rounds for player ${playerId}:`,
        rounds
    );


    // ==========================================
    // NO ROUNDS
    // ==========================================

    if (
        !rounds ||
        rounds.length === 0
    ) {

        return {

            roundsPlayed: 0,

            averageGross: 0,

            averageNet: 0,

            birdies: 0,

            eagles: 0,

            pars: 0,

            bogeys: 0,

            doubleBogeys: 0,

            points: 0,

            wins: 0

        };

    }


    // ==========================================
    // TOTALS
    // ==========================================

    const roundsPlayed =
        rounds.length;


    const totalGross =
        rounds.reduce(
            (total, round) =>
                total +
                Number(
                    round.gross_score || 0
                ),
            0
        );


    const totalNet =
        rounds.reduce(
            (total, round) =>
                total +
                Number(
                    round.net_score || 0
                ),
            0
        );


    const birdies =
        rounds.reduce(
            (total, round) =>
                total +
                Number(
                    round.birdies || 0
                ),
            0
        );


    const eagles =
        rounds.reduce(
            (total, round) =>
                total +
                Number(
                    round.eagles || 0
                ),
            0
        );


    const pars =
        rounds.reduce(
            (total, round) =>
                total +
                Number(
                    round.pars || 0
                ),
            0
        );


    const bogeys =
        rounds.reduce(
            (total, round) =>
                total +
                Number(
                    round.bogeys || 0
                ),
            0
        );


    const doubleBogeys =
        rounds.reduce(
            (total, round) =>
                total +
                Number(
                    round.double_bogeys || 0
                ),
            0
        );


    const points =
        rounds.reduce(
            (total, round) =>
                total +
                Number(
                    round.points_earned || 0
                ),
            0
        );


    // ==========================================
    // WINS
    // ==========================================

    const wins =
        rounds.filter(
            round =>
                Number(
                    round.finish_position
                ) === 1
        ).length;


    // ==========================================
    // RETURN STATS
    // ==========================================

    const stats = {

        roundsPlayed:

            roundsPlayed,


        averageGross:

            (
                totalGross /
                roundsPlayed
            ).toFixed(1),


        averageNet:

            (
                totalNet /
                roundsPlayed
            ).toFixed(1),


        birdies:

            birdies,


        eagles:

            eagles,


        pars:

            pars,


        bogeys:

            bogeys,


        doubleBogeys:

            doubleBogeys,


        points:

            points,


        wins:

            wins

    };


    console.log(
        `Calculated stats for player ${playerId}:`,
        stats
    );


    return stats;

}


// ==========================================
// GET ALL PLAYER STATS (BATCH)
// ==========================================

// ==========================================
// GET ALL PLAYER STATS (BATCH)
// ==========================================

async function getAllPlayerStats(playerIds) {

    console.log(
        "Getting stats for all players (batch):",
        playerIds
    );


    const {
        data: rounds,
        error
    } = await supabaseClient

        .from("rounds")

        .select(`
            id,
            player_id,
            gross_score,
            net_score,
            points_earned,
            birdies,
            eagles,
            pars,
            bogeys,
            double_bogeys,
            approval_status,
            finish_position
        `)

        .in(
            "player_id",
            playerIds
        )

        .eq(
            "approval_status",
            "Approved"
        );


    if (error) {

        console.error(
            "ERROR LOADING BATCH PLAYER STATS:",
            error
        );

        throw error;

    }


    console.log(
        "Batch rounds loaded:",
        rounds ? rounds.length : 0
    );


    // ==========================================
    // GROUP ROUNDS BY PLAYER ID
    // ==========================================

    const roundsByPlayer = {};

    for (
        const round of (rounds || [])
    ) {

        const pid = round.player_id;

        if (!roundsByPlayer[pid]) {

            roundsByPlayer[pid] = [];

        }

        roundsByPlayer[pid].push(round);

    }


    // ==========================================
    // CALCULATE STATS FOR EACH PLAYER
    // ==========================================

    const statsMap = {};

    for (
        const playerId of playerIds
    ) {

        const playerRounds =
            roundsByPlayer[playerId] || [];


        // ==========================================
        // NO ROUNDS
        // ==========================================

        if (playerRounds.length === 0) {

            statsMap[playerId] = {

                roundsPlayed: 0,

                averageGross: 0,

                averageNet: 0,

                birdies: 0,

                eagles: 0,

                pars: 0,

                bogeys: 0,

                doubleBogeys: 0,

                points: 0,

                wins: 0

            };

            continue;

        }


        // ==========================================
        // TOTALS
        // ==========================================

        const roundsPlayed =
            playerRounds.length;


        const totalGross =
            playerRounds.reduce(
                (total, round) =>
                    total +
                    Number(
                        round.gross_score || 0
                    ),
                0
            );


        const totalNet =
            playerRounds.reduce(
                (total, round) =>
                    total +
                    Number(
                        round.net_score || 0
                    ),
                0
            );


        const birdies =
            playerRounds.reduce(
                (total, round) =>
                    total +
                    Number(
                        round.birdies || 0
                    ),
                0
            );


        const eagles =
            playerRounds.reduce(
                (total, round) =>
                    total +
                    Number(
                        round.eagles || 0
                    ),
                0
            );


        const pars =
            playerRounds.reduce(
                (total, round) =>
                    total +
                    Number(
                        round.pars || 0
                    ),
                0
            );


        const bogeys =
            playerRounds.reduce(
                (total, round) =>
                    total +
                    Number(
                        round.bogeys || 0
                    ),
                0
            );


        const doubleBogeys =
            playerRounds.reduce(
                (total, round) =>
                    total +
                    Number(
                        round.double_bogeys || 0
                    ),
                0
            );


        const points =
            playerRounds.reduce(
                (total, round) =>
                    total +
                    Number(
                        round.points_earned || 0
                    ),
                0
            );


        // ==========================================
        // WINS
        // ==========================================

        const wins =
            playerRounds.filter(
                round =>
                    Number(
                        round.finish_position
                    ) === 1
            ).length;


        // ==========================================
        // STORE STATS
        // ==========================================

        const stats = {

            roundsPlayed:

                roundsPlayed,


            averageGross:

                (
                    totalGross /
                    roundsPlayed
                ).toFixed(1),


            averageNet:

                (
                    totalNet /
                    roundsPlayed
                ).toFixed(1),


            birdies:

                birdies,


            eagles:

                eagles,


            pars:

                pars,


            bogeys:

                bogeys,


            doubleBogeys:

                doubleBogeys,


            points:

                points,


            wins:

                wins

        };


        statsMap[playerId] = stats;

    }


    console.log(
        "Batch stats calculated for all players"
    );


    return statsMap;

}


// ==========================================
// PLAYER PROFILES
// ==========================================


// ==========================================
// GET PLAYER PROFILE
// ==========================================

// ==========================================
// GET PLAYER PROFILE
// ==========================================

async function getPlayerProfile(playerId) {

    console.log(
        "Getting profile for player:",
        playerId
    );

    // ==========================================
    // GET PROFILE RECORD
    // ==========================================

    const {
        data: profile,
        error: profileError
    } = await supabaseClient

        .from("player_profiles")

        .select(`
            id,
            player_id,
            profile_image_url,
            bio,
            favorite_course,
            favorite_club,
            hometown
        `)

        .eq(
            "player_id",
            playerId
        )

        .maybeSingle();


    if (profileError) {

        console.error(
            "ERROR LOADING PLAYER PROFILE:",
            profileError
        );

        throw profileError;

    }


    // ==========================================
    // FIND PHOTO IN STORAGE
    // ==========================================

    let profileImageUrl =
        profile?.profile_image_url || null;


    console.log(
        "Checking Player-profiles folder:",
        playerId
    );


    const {
        data: files,
        error: storageError
    } = await supabaseClient

        .storage

        .from("player-profiles")

        .list(
            String(playerId),
            {
                limit: 100
            }
        );


    if (storageError) {

        console.error(
            "ERROR READING PLAYER PHOTO FOLDER:",
            playerId,
            storageError
        );

    }

    else {

        console.log(
            `Files found for player ${playerId}:`,
            files
        );


        // ==========================================
        // FIND IMAGE
        // ==========================================

        const imageFile =
            (files || []).find(
                file => {

                    const fileName =
                        file.name.toLowerCase();

                    return (
                        fileName.endsWith(".jpg") ||
                        fileName.endsWith(".jpeg") ||
                        fileName.endsWith(".png") ||
                        fileName.endsWith(".webp")
                    );

                }
            );


        // ==========================================
        // CREATE PUBLIC URL
        // ==========================================

        if (imageFile) {

            const filePath =
                `${playerId}/${imageFile.name}`;


            console.log(
                "PLAYER PHOTO PATH:",
                filePath
            );


            const {
                data: publicUrl
            } =
                supabaseClient

                    .storage

                    .from("player-profiles")

                    .getPublicUrl(
                        filePath
                    );


            profileImageUrl =
                publicUrl.publicUrl;


            console.log(
                "PLAYER PHOTO URL:",
                profileImageUrl
            );

        }

        else {

            console.log(
                `No image found for player ${playerId}`
            );

        }

    }


    // ==========================================
    // RETURN PROFILE
    // ==========================================

    return {

        ...(profile || {}),

        player_id:
            playerId,

        profile_image_url:
            profileImageUrl

    };

}


// ==========================================
// GET ALL PLAYER PROFILES (BATCH)
// ==========================================

// ==========================================
// GET ALL PLAYER PROFILES (BATCH)
// ==========================================

async function getAllPlayerProfiles(playerIds) {

    console.log(
        "Getting profiles for all players (batch):",
        playerIds
    );


    // ==========================================
    // GET ALL PROFILE RECORDS
    // ==========================================

    const {
        data: profiles,
        error: profileError
    } = await supabaseClient

        .from("player_profiles")

        .select(`
            id,
            player_id,
            profile_image_url,
            bio,
            favorite_course,
            favorite_club,
            hometown
        `)

        .in(
            "player_id",
            playerIds
        );


    if (profileError) {

        console.error(
            "ERROR LOADING BATCH PLAYER PROFILES:",
            profileError
        );

        throw profileError;

    }


    console.log(
        "Batch profiles loaded:",
        profiles ? profiles.length : 0
    );


    // ==========================================
    // INDEX PROFILES BY PLAYER ID
    // ==========================================

    const profilesByPlayer = {};

    for (
        const profile of (profiles || [])
    ) {

        profilesByPlayer[profile.player_id] =
            profile;

    }


    // ==========================================
    // FIND PHOTOS IN STORAGE (PARALLEL)
    // ==========================================

    const storagePromises =
        playerIds.map(
            playerId => {

                console.log(
                    "Checking Player-profiles folder:",
                    playerId
                );

                return supabaseClient

                    .storage

                    .from("player-profiles")

                    .list(
                        String(playerId),
                        {
                            limit: 100
                        }
                    )

                    .then(result => ({
                        playerId,
                        data: result.data,
                        error: result.error
                    }));

            }
        );


    const storageResults =
        await Promise.all(
            storagePromises
        );


    // ==========================================
    // BUILD PROFILE MAP
    // ==========================================

    const profileMap = {};

    for (
        const result of storageResults
    ) {

        const playerId =
            result.playerId;

        const profile =
            profilesByPlayer[playerId] || null;

        let profileImageUrl =
            profile?.profile_image_url || null;


        if (result.error) {

            console.error(
                "ERROR READING PLAYER PHOTO FOLDER:",
                playerId,
                result.error
            );

        }

        else {

            console.log(
                `Files found for player ${playerId}:`,
                result.data
            );


            // ==========================================
            // FIND IMAGE
            // ==========================================

            const imageFile =
                (result.data || []).find(
                    file => {

                        const fileName =
                            file.name.toLowerCase();

                        return (
                            fileName.endsWith(".jpg") ||
                            fileName.endsWith(".jpeg") ||
                            fileName.endsWith(".png") ||
                            fileName.endsWith(".webp")
                        );

                    }
                );


            // ==========================================
            // CREATE PUBLIC URL
            // ==========================================

            if (imageFile) {

                const filePath =
                    `${playerId}/${imageFile.name}`;


                console.log(
                    "PLAYER PHOTO PATH:",
                    filePath
                );


                const {
                    data: publicUrl
                } =
                    supabaseClient

                        .storage

                        .from("player-profiles")

                        .getPublicUrl(
                            filePath
                        );


                profileImageUrl =
                    publicUrl.publicUrl;


                console.log(
                    "PLAYER PHOTO URL:",
                    profileImageUrl
                );

            }

            else {

                console.log(
                    `No image found for player ${playerId}`
                );

            }

        }


        // ==========================================
        // STORE PROFILE
        // ==========================================

        profileMap[playerId] = {

            ...(profile || {}),

            player_id:
                playerId,

            profile_image_url:
                profileImageUrl

        };

    }


    console.log(
        "Batch profiles built for all players"
    );


    return profileMap;

}


// ==========================================
// SAVE PLAYER PROFILE
// ==========================================

async function savePlayerProfile({
    playerId,
    profileImageUrl = null,
    bio = null,
    favoriteCourse = null,
    favoriteClub = null,
    hometown = null
}) {

    console.log(
        "Saving player profile:",
        playerId
    );

    if (!playerId) {

        throw new Error(
            "Player ID is required."
        );

    }

    const profileData = {

        player_id: playerId,

        profile_image_url:
            profileImageUrl,

        bio:
            bio,

        favorite_course:
            favoriteCourse,

        favorite_club:
            favoriteClub,

        hometown:
            hometown,

        updated_at:
            new Date().toISOString()

    };

    const {
        data,
        error
    } = await supabaseClient
        .from("player_profiles")
        .upsert(
            profileData,
            {
                onConflict: "player_id"
            }
        )
        .select()
        .single();

    if (error) {

        console.error(
            "ERROR SAVING PLAYER PROFILE:",
            error
        );

        throw error;

    }

    console.log(
        "Player profile saved:",
        data
    );

    return data;

}
